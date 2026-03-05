/*
 * ═══════════════════════════════════════════════════════════════
 *   AGRO-ROVER — Main ESP32 Firmware
 *   Hardware: ESP32 DevKit v1
 *
 *   Peripherals:
 *     • L298N Motor Driver  (2 DC motors)
 *     • 5V Relay            (Pump / Fertilizer sprayer)
 *     • Soil Moisture Sensor (Analog)
 *     • Neo-6M GPS Module   (UART2)
 *
 *   Communication: Firebase Realtime Database (via WiFi)
 *
 *   Libraries required (install via Arduino Library Manager):
 *     1. Firebase ESP32 Client  → https://github.com/mobizt/Firebase-ESP32
 *        (Install "Firebase Arduino Client Library for ESP8266 and ESP32")
 *     2. TinyGPSPlus            → https://github.com/mikalhart/TinyGPSPlus
 *
 *   Firebase Database Structure:
 *     /rover/
 *       control/
 *         command    → "FORWARD" | "BACKWARD" | "LEFT" | "RIGHT" | "STOP"
 *         speed      → 0-255 (PWM)
 *         pump       → true | false
 *         mode       → "AUTO" | "MANUAL"
 *         returnBase → true | false
 *       sensors/
 *         soilMoisture  → 0-100  (%)
 *         soilRaw       → 0-4095 (ADC raw)
 *         gpsLat        → float
 *         gpsLng        → float
 *         gpsSpeed      → float (km/h)
 *         gpsSats       → int
 *         gpsValid      → bool
 *         uptime        → int (seconds)
 *         rssi          → int (dBm)
 * ═══════════════════════════════════════════════════════════════
 */

#include <WiFi.h>
#include <FirebaseESP32.h>
#include <TinyGPSPlus.h>
#include <HardwareSerial.h>

// ─── USER CONFIGURATION ────────────────────────────────────────
#define WIFI_SSID       "YOUR_WIFI_SSID"
#define WIFI_PASSWORD   "YOUR_WIFI_PASSWORD"

// Firebase project settings
#define FIREBASE_HOST   "YOUR_PROJECT_ID.firebaseio.com"
#define FIREBASE_AUTH   "YOUR_DATABASE_SECRET_OR_TOKEN"
// ───────────────────────────────────────────────────────────────

// ─── PIN DEFINITIONS ───────────────────────────────────────────
// L298N Motor Driver — Motor A (Left wheel)
#define MOTOR_A_IN1   12
#define MOTOR_A_IN2   13
#define MOTOR_A_EN    14    // PWM speed

// L298N Motor Driver — Motor B (Right wheel)
#define MOTOR_B_IN3   26
#define MOTOR_B_IN4   27
#define MOTOR_B_EN    25    // PWM speed

// Pump Relay (active LOW relay — LOW = ON)
#define RELAY_PUMP    32

// Soil Moisture Sensor (Analog)
#define SOIL_SENSOR   34    // ADC1 channel (GPIO 34 is input-only, perfect for ADC)

// GPS Neo-6M (hardware UART2)
#define GPS_RX_PIN    16    // ESP32 RX2 ← GPS TX
#define GPS_TX_PIN    17    // ESP32 TX2 → GPS RX (not used by GPS but required by HardwareSerial)
#define GPS_BAUD      9600
// ───────────────────────────────────────────────────────────────

// ─── PWM CHANNELS (ESP32 LEDC) ─────────────────────────────────
#define PWM_FREQ      1000   // 1 kHz
#define PWM_RES       8      // 8-bit (0-255)
#define PWM_CH_A      0
#define PWM_CH_B      1
// ───────────────────────────────────────────────────────────────

// ─── TIMING ────────────────────────────────────────────────────
#define SENSOR_INTERVAL_MS   1000   // Upload sensor data every 1s
#define CMD_POLL_INTERVAL_MS  200   // Poll Firebase command every 200ms
// ───────────────────────────────────────────────────────────────

// ─── SOIL SENSOR CALIBRATION ──────────────────────────────────
// Measure these values with your specific sensor:
#define SOIL_DRY_VAL    3200   // ADC reading in completely dry soil / air
#define SOIL_WET_VAL     800   // ADC reading fully submerged in water
// ───────────────────────────────────────────────────────────────

// ─── GLOBAL OBJECTS ────────────────────────────────────────────
FirebaseData   fbData;
FirebaseAuth   fbAuth;
FirebaseConfig fbConfig;

TinyGPSPlus    gps;
HardwareSerial gpsSerial(2);   // UART2

// ─── STATE ─────────────────────────────────────────────────────
String  currentCmd    = "STOP";
int     motorSpeed    = 200;     // default PWM 0-255
bool    pumpOn        = false;
bool    autoMode      = true;
unsigned long lastSensorUpload = 0;
unsigned long lastCmdPoll      = 0;
unsigned long startTime        = millis();

// ═══════════════════════════════════════════════════════════════
//  Motor Control Functions
// ═══════════════════════════════════════════════════════════════
void motorsStop() {
  digitalWrite(MOTOR_A_IN1, LOW);
  digitalWrite(MOTOR_A_IN2, LOW);
  digitalWrite(MOTOR_B_IN3, LOW);
  digitalWrite(MOTOR_B_IN4, LOW);
  ledcWrite(PWM_CH_A, 0);
  ledcWrite(PWM_CH_B, 0);
}

void motorsForward(int spd) {
  digitalWrite(MOTOR_A_IN1, HIGH);
  digitalWrite(MOTOR_A_IN2, LOW);
  digitalWrite(MOTOR_B_IN3, HIGH);
  digitalWrite(MOTOR_B_IN4, LOW);
  ledcWrite(PWM_CH_A, spd);
  ledcWrite(PWM_CH_B, spd);
}

void motorsBackward(int spd) {
  digitalWrite(MOTOR_A_IN1, LOW);
  digitalWrite(MOTOR_A_IN2, HIGH);
  digitalWrite(MOTOR_B_IN3, LOW);
  digitalWrite(MOTOR_B_IN4, HIGH);
  ledcWrite(PWM_CH_A, spd);
  ledcWrite(PWM_CH_B, spd);
}

void motorsLeft(int spd) {
  // Pivot left: left wheel backward, right wheel forward
  digitalWrite(MOTOR_A_IN1, LOW);
  digitalWrite(MOTOR_A_IN2, HIGH);
  digitalWrite(MOTOR_B_IN3, HIGH);
  digitalWrite(MOTOR_B_IN4, LOW);
  ledcWrite(PWM_CH_A, spd);
  ledcWrite(PWM_CH_B, spd);
}

void motorsRight(int spd) {
  // Pivot right: left wheel forward, right wheel backward
  digitalWrite(MOTOR_A_IN1, HIGH);
  digitalWrite(MOTOR_A_IN2, LOW);
  digitalWrite(MOTOR_B_IN3, LOW);
  digitalWrite(MOTOR_B_IN4, HIGH);
  ledcWrite(PWM_CH_A, spd);
  ledcWrite(PWM_CH_B, spd);
}

void executeCommand(const String& cmd, int spd) {
  if      (cmd == "FORWARD")  motorsForward(spd);
  else if (cmd == "BACKWARD") motorsBackward(spd);
  else if (cmd == "LEFT")     motorsLeft(spd);
  else if (cmd == "RIGHT")    motorsRight(spd);
  else                        motorsStop();
}

// ═══════════════════════════════════════════════════════════════
//  Pump Control
// ═══════════════════════════════════════════════════════════════
void setPump(bool state) {
  // Relay is active LOW: LOW = ON, HIGH = OFF
  digitalWrite(RELAY_PUMP, state ? LOW : HIGH);
  pumpOn = state;
}

// ═══════════════════════════════════════════════════════════════
//  Soil Moisture Reading
// ═══════════════════════════════════════════════════════════════
int readSoilMoisture() {
  // Average 10 readings to reduce noise
  long sum = 0;
  for (int i = 0; i < 10; i++) {
    sum += analogRead(SOIL_SENSOR);
    delay(5);
  }
  return (int)(sum / 10);
}

int soilRawToPercent(int raw) {
  // Map raw ADC value to 0-100%
  // Higher ADC = dryer soil (inverted)
  int pct = map(raw, SOIL_DRY_VAL, SOIL_WET_VAL, 0, 100);
  return constrain(pct, 0, 100);
}

// ═══════════════════════════════════════════════════════════════
//  Firebase — Poll commands
// ═══════════════════════════════════════════════════════════════
void pollFirebaseCommands() {
  // Read command
  if (Firebase.getString(fbData, "/rover/control/command")) {
    String cmd = fbData.stringData();
    cmd.toUpperCase();
    if (cmd != currentCmd) {
      currentCmd = cmd;
      Serial.printf("[CMD] → %s\n", currentCmd.c_str());
    }
  }

  // Read speed
  if (Firebase.getInt(fbData, "/rover/control/speed")) {
    motorSpeed = constrain(fbData.intData(), 0, 255);
  }

  // Read pump
  if (Firebase.getBool(fbData, "/rover/control/pump")) {
    bool newPump = fbData.boolData();
    if (newPump != pumpOn) {
      setPump(newPump);
      Serial.printf("[PUMP] → %s\n", newPump ? "ON" : "OFF");
    }
  }

  // Read mode
  if (Firebase.getString(fbData, "/rover/control/mode")) {
    autoMode = (fbData.stringData() == "AUTO");
  }

  // Return to base — override command
  if (Firebase.getBool(fbData, "/rover/control/returnBase")) {
    if (fbData.boolData()) {
      currentCmd = "STOP";  // Placeholder: integrate with GPS navigation logic here
      Serial.println("[RTB] Return to Base triggered");
    }
  }

  // Execute current command
  executeCommand(currentCmd, motorSpeed);
}

// ═══════════════════════════════════════════════════════════════
//  Firebase — Upload sensor data
// ═══════════════════════════════════════════════════════════════
void uploadSensorData() {
  int   soilRaw = readSoilMoisture();
  int   soilPct = soilRawToPercent(soilRaw);
  int   rssi    = WiFi.RSSI();
  int   uptime  = (millis() - startTime) / 1000;

  // Build JSON payload for atomic update
  FirebaseJson json;
  json.set("soilMoisture", soilPct);
  json.set("soilRaw",      soilRaw);
  json.set("uptime",       uptime);
  json.set("rssi",         rssi);
  json.set("pumpOn",       pumpOn);
  json.set("command",      currentCmd);
  json.set("speed",        motorSpeed);

  // GPS data (only update if fix is valid)
  if (gps.location.isValid() && gps.location.age() < 2000) {
    json.set("gpsLat",   gps.location.lat());
    json.set("gpsLng",   gps.location.lng());
    json.set("gpsSpeed", gps.speed.kmph());
    json.set("gpsSats",  (int)gps.satellites.value());
    json.set("gpsValid", true);
  } else {
    json.set("gpsValid", false);
    json.set("gpsSats",  0);
  }

  Firebase.updateNode(fbData, "/rover/sensors", json);

  Serial.printf("[SOIL] Raw:%d  Moisture:%d%%  [GPS] Valid:%s  [RSSI] %ddBm\n",
    soilRaw, soilPct,
    gps.location.isValid() ? "YES" : "NO",
    rssi);
}

// ═══════════════════════════════════════════════════════════════
//  SETUP
// ═══════════════════════════════════════════════════════════════
void setup() {
  Serial.begin(115200);
  Serial.println("\n\n=== AGRO-ROVER MAIN CONTROLLER BOOT ===");

  // ── Motor pins ──
  pinMode(MOTOR_A_IN1, OUTPUT);
  pinMode(MOTOR_A_IN2, OUTPUT);
  pinMode(MOTOR_B_IN3, OUTPUT);
  pinMode(MOTOR_B_IN4, OUTPUT);

  // LEDC PWM for ENA/ENB
  ledcSetup(PWM_CH_A, PWM_FREQ, PWM_RES);
  ledcAttachPin(MOTOR_A_EN, PWM_CH_A);
  ledcSetup(PWM_CH_B, PWM_FREQ, PWM_RES);
  ledcAttachPin(MOTOR_B_EN, PWM_CH_B);
  motorsStop();
  Serial.println("[OK] Motors initialized");

  // ── Relay pin ──
  pinMode(RELAY_PUMP, OUTPUT);
  digitalWrite(RELAY_PUMP, HIGH);   // OFF by default (active LOW)
  Serial.println("[OK] Pump relay initialized (OFF)");

  // ── Soil sensor ──
  analogReadResolution(12);          // 12-bit ADC (0-4095)
  analogSetAttenuation(ADC_11db);    // Full range 0-3.3V
  Serial.println("[OK] Soil moisture sensor initialized");

  // ── GPS (UART2) ──
  gpsSerial.begin(GPS_BAUD, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);
  Serial.println("[OK] GPS serial initialized");

  // ── WiFi ──
  Serial.printf("[WiFi] Connecting to %s", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.printf("\n[WiFi] Connected! IP: %s\n", WiFi.localIP().toString().c_str());

  // ── Firebase ──
  fbConfig.host             = FIREBASE_HOST;
  fbConfig.signer.tokens.legacy_token = FIREBASE_AUTH;
  Firebase.begin(&fbConfig, &fbAuth);
  Firebase.reconnectWiFi(true);
  fbData.setResponseSize(4096);
  Serial.println("[OK] Firebase connected");

  // ── Write initial heartbeat ──
  Firebase.setString(fbData, "/rover/status/state", "ONLINE");
  Firebase.setString(fbData, "/rover/status/ip",    WiFi.localIP().toString().c_str());

  Serial.println("=== BOOT COMPLETE — ROVER READY ===\n");
}

// ═══════════════════════════════════════════════════════════════
//  LOOP
// ═══════════════════════════════════════════════════════════════
void loop() {
  unsigned long now = millis();

  // ── Feed GPS parser ──
  while (gpsSerial.available()) {
    gps.encode(gpsSerial.read());
  }

  // ── Poll Firebase commands (fast cycle) ──
  if (now - lastCmdPoll >= CMD_POLL_INTERVAL_MS) {
    lastCmdPoll = now;
    if (WiFi.status() == WL_CONNECTED) {
      pollFirebaseCommands();
    } else {
      // WiFi dropped — safe stop
      motorsStop();
      WiFi.reconnect();
    }
  }

  // ── Upload sensor data (slow cycle) ──
  if (now - lastSensorUpload >= SENSOR_INTERVAL_MS) {
    lastSensorUpload = now;
    if (WiFi.status() == WL_CONNECTED) {
      uploadSensorData();
    }
  }
}
