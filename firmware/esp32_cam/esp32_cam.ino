/*
 * ═══════════════════════════════════════════════════════════════
 *   AGRO-ROVER — ESP32-CAM Firmware
 *   Hardware: AI-Thinker ESP32-CAM module (OV2640 camera)
 *             FTDI adapter for programming (use 3.3V!)
 *
 *   This sketch starts a MJPEG camera stream server on the LAN
 *   and also publishes the stream URL to Firebase so the
 *   dashboard can embed it in the live feed panel.
 *
 *   ⚠️  FTDI wiring for programming:
 *        FTDI TX  → CAM U0R (GPIO3)
 *        FTDI RX  → CAM U0T (GPIO1)
 *        FTDI GND → CAM GND
 *        FTDI 5V  → CAM 5V  (do NOT use 3.3V from FTDI — CAM needs 5V)
 *        GPIO0    → GND     (only during upload, remove after)
 *
 *   Libraries required:
 *     1. ESP32 board package (includes camera & HTTP server)
 *        https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
 *     2. Firebase Arduino Client Library (same as main ESP32)
 *
 *   After uploading:
 *     1. REMOVE GPIO0-GND jumper
 *     2. Press RESET
 *     3. Stream URL will be printed to Serial and written to Firebase
 *     4. Open http://<cam_ip>/stream in browser to verify
 * ═══════════════════════════════════════════════════════════════
 */

#include "esp_camera.h"
#include <WiFi.h>
#include <esp_http_server.h>
#include <FirebaseESP32.h>

// ─── USER CONFIGURATION ────────────────────────────────────────
#define WIFI_SSID      "YOUR_WIFI_SSID"
#define WIFI_PASSWORD  "YOUR_WIFI_PASSWORD"
#define FIREBASE_HOST  "YOUR_PROJECT_ID.firebaseio.com"
#define FIREBASE_AUTH  "YOUR_DATABASE_SECRET_OR_TOKEN"
// ───────────────────────────────────────────────────────────────

// ─── AI-THINKER ESP32-CAM PIN MAP ──────────────────────────────
// ⚠️  Do NOT change these — they are fixed by the PCB layout
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27
#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22
// ───────────────────────────────────────────────────────────────

// Onboard LED on GPIO4 (flash LED)
#define LED_PIN 4

FirebaseData   fbData;
FirebaseAuth   fbAuth;
FirebaseConfig fbConfig;

// ═══════════════════════════════════════════════════════════════
//  MJPEG Stream Handler
// ═══════════════════════════════════════════════════════════════
#define PART_BOUNDARY "123456789000000000000987654321"
static const char* _STREAM_CONTENT_TYPE =
    "multipart/x-mixed-replace;boundary=" PART_BOUNDARY;
static const char* _STREAM_BOUNDARY = "\r\n--" PART_BOUNDARY "\r\n";
static const char* _STREAM_PART =
    "Content-Type: image/jpeg\r\nContent-Length: %u\r\n\r\n";

httpd_handle_t stream_httpd = NULL;

esp_err_t stream_handler(httpd_req_t* req) {
  camera_fb_t* fb = NULL;
  esp_err_t    res = ESP_OK;
  char         part_buf[64];

  res = httpd_resp_set_type(req, _STREAM_CONTENT_TYPE);
  if (res != ESP_OK) return res;

  // Allow cross-origin access so the web dashboard can embed the stream
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");

  while (true) {
    fb = esp_camera_fb_get();
    if (!fb) {
      Serial.println("[CAM] Frame capture failed");
      res = ESP_FAIL;
      break;
    }

    // Send boundary
    res = httpd_resp_send_chunk(req, _STREAM_BOUNDARY, strlen(_STREAM_BOUNDARY));
    if (res != ESP_OK) break;

    // Send part header
    size_t hlen = snprintf(part_buf, sizeof(part_buf), _STREAM_PART, fb->len);
    res = httpd_resp_send_chunk(req, part_buf, hlen);
    if (res != ESP_OK) break;

    // Send JPEG data
    res = httpd_resp_send_chunk(req, (const char*)fb->buf, fb->len);
    esp_camera_fb_return(fb);
    fb = NULL;
    if (res != ESP_OK) break;
  }

  if (fb) esp_camera_fb_return(fb);
  return res;
}

// Single JPEG snapshot handler
esp_err_t capture_handler(httpd_req_t* req) {
  camera_fb_t* fb = esp_camera_fb_get();
  if (!fb) {
    httpd_resp_send_500(req);
    return ESP_FAIL;
  }
  httpd_resp_set_type(req, "image/jpeg");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
  httpd_resp_set_hdr(req, "Content-Disposition", "inline; filename=capture.jpg");
  esp_err_t res = httpd_resp_send(req, (const char*)fb->buf, fb->len);
  esp_camera_fb_return(fb);
  return res;
}

void startCameraServer() {
  httpd_config_t config = HTTPD_DEFAULT_CONFIG();
  config.server_port    = 80;
  config.max_uri_handlers = 8;

  httpd_uri_t stream_uri = {
    .uri       = "/stream",
    .method    = HTTP_GET,
    .handler   = stream_handler,
    .user_ctx  = NULL
  };
  httpd_uri_t capture_uri = {
    .uri       = "/capture",
    .method    = HTTP_GET,
    .handler   = capture_handler,
    .user_ctx  = NULL
  };

  if (httpd_start(&stream_httpd, &config) == ESP_OK) {
    httpd_register_uri_handler(stream_httpd, &stream_uri);
    httpd_register_uri_handler(stream_httpd, &capture_uri);
    Serial.println("[HTTP] Stream server started on port 80");
  }
}

// ═══════════════════════════════════════════════════════════════
//  Camera Configuration
// ═══════════════════════════════════════════════════════════════
bool initCamera() {
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer   = LEDC_TIMER_0;
  config.pin_d0       = Y2_GPIO_NUM;
  config.pin_d1       = Y3_GPIO_NUM;
  config.pin_d2       = Y4_GPIO_NUM;
  config.pin_d3       = Y5_GPIO_NUM;
  config.pin_d4       = Y6_GPIO_NUM;
  config.pin_d5       = Y7_GPIO_NUM;
  config.pin_d6       = Y8_GPIO_NUM;
  config.pin_d7       = Y9_GPIO_NUM;
  config.pin_xclk     = XCLK_GPIO_NUM;
  config.pin_pclk     = PCLK_GPIO_NUM;
  config.pin_vsync    = VSYNC_GPIO_NUM;
  config.pin_href     = HREF_GPIO_NUM;
  config.pin_sscb_sda = SIOD_GPIO_NUM;
  config.pin_sscb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn     = PWDN_GPIO_NUM;
  config.pin_reset    = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;

  // Higher PSRAM boards: use bigger frame & higher quality
  if (psramFound()) {
    config.frame_size   = FRAMESIZE_VGA;   // 640x480
    config.jpeg_quality = 12;              // 0-63, lower = higher quality
    config.fb_count     = 2;
  } else {
    config.frame_size   = FRAMESIZE_QVGA;  // 320x240
    config.jpeg_quality = 20;
    config.fb_count     = 1;
  }

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("[CAM] Init FAILED: 0x%x\n", err);
    return false;
  }

  // Fine-tune sensor
  sensor_t* s = esp_camera_sensor_get();
  s->set_brightness(s, 1);      // -2 to 2
  s->set_contrast(s, 1);        // -2 to 2
  s->set_saturation(s, 0);      // -2 to 2
  s->set_sharpness(s, 1);       // -2 to 2
  s->set_whitebal(s, 1);        // Auto WB
  s->set_awb_gain(s, 1);
  s->set_exposure_ctrl(s, 1);   // Auto exposure
  s->set_aec2(s, 1);
  s->set_gainceiling(s, (gainceiling_t)2);
  s->set_colorbar(s, 0);        // No colorbar test pattern
  s->set_hmirror(s, 0);
  s->set_vflip(s, 0);

  Serial.println("[CAM] Camera initialized OK");
  return true;
}

// ═══════════════════════════════════════════════════════════════
//  SETUP
// ═══════════════════════════════════════════════════════════════
void setup() {
  Serial.begin(115200);
  Serial.println("\n=== AGRO-ROVER ESP32-CAM BOOT ===");

  // Flash LED OFF
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  // ── Camera ──
  if (!initCamera()) {
    Serial.println("Camera init failed! Halting.");
    while (true) {
      digitalWrite(LED_PIN, HIGH); delay(200);
      digitalWrite(LED_PIN, LOW);  delay(200);
    }
  }

  // ── WiFi ──
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.printf("[WiFi] Connecting to %s", WIFI_SSID);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  String ip = WiFi.localIP().toString();
  Serial.printf("\n[WiFi] Connected! IP: %s\n", ip.c_str());

  // ── HTTP stream server ──
  startCameraServer();
  String streamUrl = "http://" + ip + "/stream";
  Serial.printf("[Stream] URL: %s\n", streamUrl.c_str());
  Serial.printf("[Capture] URL: http://%s/capture\n", ip.c_str());

  // ── Firebase ──
  fbConfig.host = FIREBASE_HOST;
  fbConfig.signer.tokens.legacy_token = FIREBASE_AUTH;
  Firebase.begin(&fbConfig, &fbAuth);
  Firebase.reconnectWiFi(true);

  // Publish stream URL to Firebase
  Firebase.setString(fbData, "/rover/camera/streamUrl",  streamUrl);
  Firebase.setString(fbData, "/rover/camera/captureUrl", "http://" + ip + "/capture");
  Firebase.setString(fbData, "/rover/camera/status",     "ONLINE");
  Firebase.setString(fbData, "/rover/camera/ip",         ip);

  Serial.println("=== ESP32-CAM READY ===\n");
  // Blink LED 3x to signal ready
  for (int i = 0; i < 3; i++) {
    digitalWrite(LED_PIN, HIGH); delay(100);
    digitalWrite(LED_PIN, LOW);  delay(100);
  }
}

// ═══════════════════════════════════════════════════════════════
//  LOOP
// ═══════════════════════════════════════════════════════════════
void loop() {
  // Heartbeat: update camera status every 10 seconds
  static unsigned long lastHB = 0;
  if (millis() - lastHB > 10000) {
    lastHB = millis();
    Firebase.setInt(fbData, "/rover/camera/uptime", (int)(millis() / 1000));
    Firebase.setInt(fbData, "/rover/camera/rssi",   WiFi.RSSI());
  }

  // Reconnect if WiFi drops
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WiFi] Reconnecting...");
    WiFi.reconnect();
    delay(3000);
  }

  delay(10); // Allow background tasks
}
