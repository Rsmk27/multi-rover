# Agro-Rover: Web-Controlled Agricultural Robot

A web-controlled agricultural rover built with dual ESP32 microcontrollers. It features live video streaming, real-time GPS tracking, soil moisture sensing, automated water/fertilizer spraying, and an AI-powered AgriChatbot. The system is managed via a React + Vite dashboard connected through Firebase Realtime Database.

## Tech Stack
- **Frontend Dashboard**: React 19, Vite, Leaflet Maps, Recharts, Tailwind/CSS.
- **Microcontrollers**: ESP32 DevKit v1 (Main Logic), AI-Thinker ESP32-CAM (Video Stream).
- **Cloud / Realtime Sync**: Firebase Realtime Database.
- **AI Chatbot**: Groq API (Llama 3.3).

---

## Hardware & Wiring

![Circuit Diagram](./agri%20rover.png)

### 1. Main ESP32 (Control & Sensors)
This ESP32 handles motors, pump, moisture sensor, GPS, and servos.

| Component | ESP32 Pin | Notes |
| :--- | :--- | :--- |
| **L298N Motor Driver** | | |
| Left Motor (IN1, IN2) | GPIO 12, GPIO 13 | Direction control only (EN pins fixed to 5V) |
| Right Motor (IN3, IN4) | GPIO 26, GPIO 27 | Direction control only |
| **5V Relay (Pump)** | GPIO 32 | Active-LOW relay |
| **Soil Moisture Sensor** | GPIO 34 (ADC1) | Analog reading |
| **Neo-6M GPS** | | |
| GPS RX | GPIO 16 (TX2) | Serial2 RX |
| GPS TX | GPIO 17 (RX2) | Serial2 TX |
| **Servos** | | |
| Camera Pan Servo | GPIO 18 | Sweeps 0-180° when moving |
| Sensor Arm Servo | GPIO 19 | Raised (90°) / Lowered (0°) |

### 2. ESP32-CAM (Video Streaming)
Used purely for the MJPEG stream and publishing its IP to Firebase.

**FTDI Wiring for Programming:**
- U0R (GPIO3) → FTDI TX
- U0T (GPIO1) → FTDI RX
- GND → FTDI GND
- 5V → FTDI 5V (Must provide 5V, not 3.3V. ESP32-CAM requires high current)
- GPIO0 → GND (Only during upload, remove to run normally)

---

## 1. Firebase Setup

1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Create a new project (e.g., **multi-rover**).
3. Enable **Realtime Database** in Test Mode (or write secure rules allowing read/write).
4. Add a Web App to the project and copy the configuration.

## 2. Firmware Setup (Arduino IDE)

### Prerequisites
Install the following libraries in Arduino IDE:
- `Firebase ESP32 Client` by mobizt
- `TinyGPSPlus` by Mikal Hart
- `ESP32Servo` by Kevin Harrington

### Main ESP32 (`firmware/esp32_main/esp32_main.ino`)
1. Open the file in Arduino IDE.
2. Update the credentials at the top:
   ```cpp
   #define WIFI_SSID       "YOUR_WIFI_SSID"
   #define WIFI_PASSWORD   "YOUR_WIFI_PASSWORD"
   #define FIREBASE_HOST   "YOUR_PROJECT_ID.firebaseio.com"
   #define FIREBASE_AUTH   "YOUR_DATABASE_SECRET_OR_TOKEN"
   ```
3. Select board: **DOIT ESP32 DEVKIT V1**.
4. Compile and Upload.

### ESP32-CAM (`firmware/esp32_cam/esp32_cam.ino`)
1. Open the file in Arduino IDE.
2. Update the WiFi and Firebase credentials exactly as above.
3. Select board: **AI Thinker ESP32-CAM**.
4. Compile and Upload (remember to ground GPIO0 during upload, then remove and reboot).

## 3. Web Dashboard Setup

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)

### Installation
1. Navigate to the project root:
   ```bash
   cd multi-rover
   ```
2. Install dependencies:
   ```bash
   npm install
   ```

### Environment Configuration
1. Create a `.env` file in the root folder with the following contents:
   ```env
   # AI Chatbot API (Groq)
   VITE_GROQ_API_KEY=your_groq_api_key

   # Firebase Setup
   VITE_FIREBASE_API_KEY=your_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   VITE_FIREBASE_DATABASE_URL=https://your_project-default-rtdb.firebaseio.com
   VITE_FIREBASE_PROJECT_ID=your_project
   VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   ```

### Running the Dashboard
Start the Vite development server:
```bash
npm run dev
```
Open the provided local URL (typically `http://localhost:5173`) in your browser.

## Usage Guide
- **Connection Banner:** At the top of the dashboard, you will be notified if the Main ESP32 or ESP32-CAM goes offline.
- **Rover Controls:** Use the UI buttons or Arrow Keys (`↑ ↓ ← →`, Space to Stop) when the mode is set to Manual.
- **Auto Pump:** Adjust the moisture threshold slider. The rover will automatically trigger the pump if the soil moisture falls below this value when set to Auto mode.
- **Return to Base:** Click the Home icon to autonomously command the rover to head back to its designated base target.
- **Camera Feed:** The stream will auto-populate if the ESP32-CAM is online and connected to Firebase. You can also manually type the IP address if your local firewall blocks the Firebase update.
- **AgriAI Chatbot:** Click the floating `🌿 AgriAI` button to chat with the Llama-3-powered agricultural assistant about crop advice, maintenance, etc.


developed by @Rsmk27 and @jagadeesh
