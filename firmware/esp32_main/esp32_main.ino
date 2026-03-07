/*
 * ═══════════════════════════════════════════════════════════════
 *   AGRO-ROVER — Main ESP32 Firmware
 *   Hardware: ESP32 DevKit v1
 *
 *   Peripherals:
 *     · L298N Motor Driver   (2 DC motors)
 *     · 5V Relay             (Pump / Fertilizer sprayer)
 *     · Soil Moisture Sensor (Analog)
 *     · Neo-6M GPS Module    (UART2)
 *     · Servo – Camera Pan   (slow 0->180->0 sweep when driving)
 *     · Servo – Arm          (manual angle)
 *
 *   Communication: Firebase Realtime Database (via WiFi)
 *
 *   Libraries required (install via Arduino Library Manager):
 *     1. Firebase ESP32 Client  (mobizt/Firebase-ESP32)
 *     2. TinyGPSPlus            (mikalhart/TinyGPSPlus)
 *     3. ESP32Servo             (madhephaestus/ESP32Servo)
 *
 *   Firebase Database Structure:
 *     /rover/
 *       control/
 *         command           -> "FORWARD"|"BACKWARD"|"LEFT"|"RIGHT"|"STOP"
 *         speed             -> 0-255 (PWM)
 *         pump              -> true | false  (manual mode only)
 *         mode              -> "AUTO" | "MANUAL"
 *         returnBase        -> true | false
 *         servoCam          -> 0-180 (manual target; locked while moving)
 *         servoArm          -> 0-180 (degrees)
 *         moistureThreshold -> 0-100 (%) auto-pump triggers below this
 *       sensors/
 *         soilMoisture      -> 0-100  (%)
 *         soilRaw           -> 0-4095 (ADC raw)
 *         gpsLat / gpsLng / gpsSpeed / gpsSats / gpsValid
 *         uptime            -> int (seconds)
 *         rssi              -> int (dBm)
 *         autoPumpActive    -> bool
 *         moistureThreshold -> int  (echoes current threshold)
 *         camAngle          -> int  (current cam servo angle)
 * ═══════════════════════════════════════════════════════════════
 */

#include <WiFi.h>
#include <FirebaseESP32.h>
#include <TinyGPSPlus.h>
#include <HardwareSerial.h>
#include <ESP32Servo.h>

// ─── USER CONFIGURATION ────────────────────────────────────────
#define WIFI_SSID       "YOUR_WIFI_SSID"
#define WIFI_PASSWORD   "YOUR_WIFI_PASSWORD"
#define FIREBASE_HOST   "YOUR_PROJECT_ID.firebaseio.com"
#define FIREBASE_AUTH   "YOUR_DATABASE_SECRET_OR_TOKEN"
// ───────────────────────────────────────────────────────────────

// ─── PIN DEFINITIONS ───────────────────────────────────────────// L298N Motor Driver — Motor A (Left wheel)
#define MOTOR_A_IN1   12
#define MOTOR_A_IN2   13

// L298N Motor Driver — Motor B (Right wheel)
#define MOTOR_B_IN3   26
#define MOTOR_B_IN4   27

#define RELAY_PUMP    32    // Active-LOW relay

#define SERVO_CAM_PIN 18
#define SERVO_ARM_PIN 19

#define SOIL_SENSOR   34    // ADC1 (input-only pin)

#define GPS_RX_PIN    16
#define GPS_TX_PIN    17
#define GPS_BAUD      9600
// ───────────────────────────────────────────────────────────────

// ─── TIMING ────────────────────────────────────────────────────
#define SENSOR_INTERVAL_MS    1000   // upload sensor data every 1 s
#define CMD_POLL_INTERVAL_MS   200   // poll Firebase every 200 ms
#define SERVO_STEP_MS           20   // move cam servo 1 deg every 20 ms (~3 s full sweep)
// ───────────────────────────────────────────────────────────────

// ─── SOIL CALIBRATION ──────────────────────────────────────────
#define SOIL_DRY_VAL  3200   // ADC reading in dry air
#define SOIL_WET_VAL   800   // ADC reading fully submerged
// ───────────────────────────────────────────────────────────────

// ─── GLOBALS ───────────────────────────────────────────────────
FirebaseData   fbData;
FirebaseAuth   fbAuth;
FirebaseConfig fbConfig;

TinyGPSPlus    gps;
HardwareSerial gpsSerial(2);

Servo servoCam;
Servo servoArm;

// ── Control state ──────────────────────────────────────────────
String  currentCmd        = "STOP";
bool    pumpOn            = false;
bool    autoMode          = true;
int     servoCamTarget    = 90;   // firebase-commanded angle (used while stopped)
int     servoArmAngle     = 90;
int     moistureThreshold = 30;   // auto-pump below this %
bool    autoPumpActive    = false;

// ── Camera sweep state ─────────────────────────────────────────
int           camAngle    = 90;   // current physical position
int           camDir      = 1;    // 1=towards 180, -1=towards 0
bool          wasSweeping = false;
unsigned long lastServoStep = 0;

// ── Timing ─────────────────────────────────────────────────────
unsigned long lastSensorUpload = 0;
unsigned long lastCmdPoll      = 0;
unsigned long startTime;

// ═══════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════
bool isMoving() { return currentCmd != "STOP"; }

// ── Motors — direction only (EN pins not wired) ────────────────
void motorsStop() {
  digitalWrite(MOTOR_A_IN1, LOW); digitalWrite(MOTOR_A_IN2, LOW);
  digitalWrite(MOTOR_B_IN3, LOW); digitalWrite(MOTOR_B_IN4, LOW);
}
void motorsForward() {
  digitalWrite(MOTOR_A_IN1, HIGH); digitalWrite(MOTOR_A_IN2, LOW);
  digitalWrite(MOTOR_B_IN3, HIGH); digitalWrite(MOTOR_B_IN4, LOW);
}
void motorsBackward() {
  digitalWrite(MOTOR_A_IN1, LOW); digitalWrite(MOTOR_A_IN2, HIGH);
  digitalWrite(MOTOR_B_IN3, LOW); digitalWrite(MOTOR_B_IN4, HIGH);
}
void motorsLeft() {
  digitalWrite(MOTOR_A_IN1, LOW); digitalWrite(MOTOR_A_IN2, HIGH);
  digitalWrite(MOTOR_B_IN3, HIGH); digitalWrite(MOTOR_B_IN4, LOW);
}
void motorsRight() {
  digitalWrite(MOTOR_A_IN1, HIGH); digitalWrite(MOTOR_A_IN2, LOW);
  digitalWrite(MOTOR_B_IN3, LOW);  digitalWrite(MOTOR_B_IN4, HIGH);
}
void executeCommand(const String& cmd) {
  if      (cmd == "FORWARD")  motorsForward();
  else if (cmd == "BACKWARD") motorsBackward();
  else if (cmd == "LEFT")     motorsLeft();
  else if (cmd == "RIGHT")    motorsRight();
  else                        motorsStop();
}

// ── Pump ───────────────────────────────────────────────────────
void setPump(bool on) {
  if (on == pumpOn) return;
  digitalWrite(RELAY_PUMP, on ? LOW : HIGH);   // active-LOW
  pumpOn = on;
  Serial.printf("[PUMP] %s\n", on ? "ON" : "OFF");
}

// ── Soil ───────────────────────────────────────────────────────
int readSoilRaw() {
  long s = 0;
  for (int i = 0; i < 10; i++) { s += analogRead(SOIL_SENSOR); delay(5); }
  return (int)(s / 10);
}
int soilRawToPercent(int raw) {
  return constrain(map(raw, SOIL_DRY_VAL, SOIL_WET_VAL, 0, 100), 0, 100);
}

// ═══════════════════════════════════════════════════════════════
//  Camera servo updater — called every loop iteration
//  While moving : slow 0->180->0 sweep (1 deg / SERVO_STEP_MS)
//  While stopped: smoothly returns to Firebase-commanded target
// ═══════════════════════════════════════════════════════════════
void updateCamServo() {
  unsigned long now = millis();
  if (now - lastServoStep < SERVO_STEP_MS) return;
  lastServoStep = now;

  if (isMoving()) {
    // Sweep mode
    wasSweeping = true;
    camAngle += camDir;
    if (camAngle >= 180) { camAngle = 180; camDir = -1; }
    if (camAngle <= 0)   { camAngle = 0;   camDir =  1; }
    servoCam.write(camAngle);
  } else {
    // Return-to-target mode
    if (wasSweeping) {
      // Just stopped — pick shortest direction back to target
      wasSweeping = false;
    }
    if (camAngle < servoCamTarget) { camAngle++; servoCam.write(camAngle); }
    else if (camAngle > servoCamTarget) { camAngle--; servoCam.write(camAngle); }
  }
}

// ═══════════════════════════════════════════════════════════════
//  Firebase — poll commands
// ═══════════════════════════════════════════════════════════════
void pollFirebaseCommands() {
  // Command
  if (Firebase.getString(fbData, "/rover/control/command")) {
    String cmd = fbData.stringData();
    cmd.toUpperCase();
    if (cmd != currentCmd) {
      currentCmd = cmd;
      Serial.printf("[CMD] -> %s\n", currentCmd.c_str());
    }
  }

  // Speed (stored in Firebase for future use; not applied without EN pins)
  if (Firebase.getInt(fbData, "/rover/control/speed")) {
    // Speed value acknowledged but EN pins not wired — ignored
  }

  // Mode
  if (Firebase.getString(fbData, "/rover/control/mode"))
    autoMode = (fbData.stringData() == "AUTO");

  // Moisture threshold
  if (Firebase.getInt(fbData, "/rover/control/moistureThreshold")) {
    int t = constrain(fbData.intData(), 0, 100);
    if (t != moistureThreshold) {
      moistureThreshold = t;
      Serial.printf("[THRESHOLD] -> %d%%\n", moistureThreshold);
    }
  }

  // Manual pump (only in MANUAL mode)
  if (!autoMode && Firebase.getBool(fbData, "/rover/control/pump")) {
    setPump(fbData.boolData());
  }

  // Return to base
  if (Firebase.getBool(fbData, "/rover/control/returnBase") && fbData.boolData()) {
    currentCmd = "STOP";
    Serial.println("[RTB] Return to Base triggered");
  }

  // Camera servo target (only honoured while stopped)
  if (!isMoving() && Firebase.getInt(fbData, "/rover/control/servoCam")) {
    int t = constrain(fbData.intData(), 0, 180);
    if (t != servoCamTarget) {
      servoCamTarget = t;
      Serial.printf("[CAM TARGET] -> %d deg\n", servoCamTarget);
    }
  }

  // Arm servo
  if (Firebase.getInt(fbData, "/rover/control/servoArm")) {
    int a = constrain(fbData.intData(), 0, 180);
    if (a != servoArmAngle) {
      servoArmAngle = a;
      servoArm.write(servoArmAngle);
      Serial.printf("[SERVO ARM] -> %d deg\n", servoArmAngle);
    }
  }

  // Apply drive command
  executeCommand(currentCmd);
}

// ═══════════════════════════════════════════════════════════════
//  Firebase — upload sensor data + auto-pump logic
// ═══════════════════════════════════════════════════════════════
void uploadSensorData() {
  int soilRaw = readSoilRaw();
  int soilPct = soilRawToPercent(soilRaw);
  int rssi    = WiFi.RSSI();
  int uptime  = (millis() - startTime) / 1000;

  // Auto-pump logic (AUTO mode only)
  if (autoMode) {
    if (soilPct < moistureThreshold && !pumpOn) {
      setPump(true);
      autoPumpActive = true;
      Serial.printf("[AUTO-PUMP] ON  — %d%% < threshold %d%%\n", soilPct, moistureThreshold);
    } else if (soilPct >= moistureThreshold && pumpOn && autoPumpActive) {
      setPump(false);
      autoPumpActive = false;
      Serial.printf("[AUTO-PUMP] OFF — %d%% >= threshold %d%%\n", soilPct, moistureThreshold);
    }
  }

  // Build JSON
  FirebaseJson json;
  json.set("soilMoisture",      soilPct);
  json.set("soilRaw",           soilRaw);
  json.set("uptime",            uptime);
  json.set("rssi",              rssi);
  json.set("pumpOn",            pumpOn);
  json.set("command",           currentCmd);
  json.set("autoPumpActive",    autoPumpActive);
  json.set("moistureThreshold", moistureThreshold);
  json.set("camAngle",          camAngle);

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

  Serial.printf("[SOIL] %d%%(%d)  [THRESH] %d%%  [AUTO-PUMP] %s  [CAM] %ddeg  [RSSI] %ddBm\n",
    soilPct, soilRaw, moistureThreshold, autoPumpActive ? "ON" : "OFF", camAngle, rssi);
}

// ═══════════════════════════════════════════════════════════════
//  SETUP
// ═══════════════════════════════════════════════════════════════
void setup() {
  Serial.begin(115200);
  Serial.println("\n\n=== AGRO-ROVER BOOT ===");

  // Motors — direction pins only
  pinMode(MOTOR_A_IN1, OUTPUT); pinMode(MOTOR_A_IN2, OUTPUT);
  pinMode(MOTOR_B_IN3, OUTPUT); pinMode(MOTOR_B_IN4, OUTPUT);
  // EN pins not wired — no ledcAttach needed
  motorsStop();
  Serial.println("[OK] Motors (direction-only, EN pins not wired)");

  // Pump relay
  pinMode(RELAY_PUMP, OUTPUT);
  digitalWrite(RELAY_PUMP, HIGH);   // OFF (active-LOW)
  Serial.println("[OK] Pump relay");

  // Soil sensor
  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);
  Serial.println("[OK] Soil sensor");

  // GPS
  gpsSerial.begin(GPS_BAUD, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);
  Serial.println("[OK] GPS");

  // Servos
  ESP32PWM::allocateTimer(0); ESP32PWM::allocateTimer(1);
  ESP32PWM::allocateTimer(2); ESP32PWM::allocateTimer(3);
  servoCam.setPeriodHertz(50); servoCam.attach(SERVO_CAM_PIN, 500, 2500);
  servoArm.setPeriodHertz(50); servoArm.attach(SERVO_ARM_PIN, 500, 2500);
  servoCam.write(servoCamTarget);
  servoArm.write(servoArmAngle);
  camAngle = servoCamTarget;
  Serial.println("[OK] Servos");

  // WiFi
  Serial.printf("[WiFi] Connecting to %s", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  Serial.printf("\n[WiFi] Connected — IP: %s\n", WiFi.localIP().toString().c_str());

  // Firebase
  fbConfig.host = FIREBASE_HOST;
  fbConfig.signer.tokens.legacy_token = FIREBASE_AUTH;
  Firebase.begin(&fbConfig, &fbAuth);
  Firebase.reconnectWiFi(true);
  fbData.setResponseSize(4096);
  Serial.println("[OK] Firebase");

  // Write initial state
  Firebase.setString(fbData, "/rover/status/state", "ONLINE");
  Firebase.setString(fbData, "/rover/status/ip", WiFi.localIP().toString().c_str());
  Firebase.setInt(fbData, "/rover/control/moistureThreshold", moistureThreshold);

  startTime = millis();
  Serial.println("=== BOOT COMPLETE — READY ===\n");
}

// ═══════════════════════════════════════════════════════════════
//  LOOP
// ═══════════════════════════════════════════════════════════════
void loop() {
  unsigned long now = millis();

  // Feed GPS
  while (gpsSerial.available()) gps.encode(gpsSerial.read());

  // Update camera servo (sweep or smooth return)
  updateCamServo();

  // Poll Firebase commands (200 ms)
  if (now - lastCmdPoll >= CMD_POLL_INTERVAL_MS) {
    lastCmdPoll = now;
    if (WiFi.status() == WL_CONNECTED) {
      pollFirebaseCommands();
    } else {
      motorsStop();
      WiFi.reconnect();
    }
  }

  // Upload sensor data (1 s)
  if (now - lastSensorUpload >= SENSOR_INTERVAL_MS) {
    lastSensorUpload = now;
    if (WiFi.status() == WL_CONNECTED) uploadSensorData();
  }
}
