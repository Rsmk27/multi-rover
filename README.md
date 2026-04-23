# 🌱 Agro-Rover: Web-Controlled Agricultural Robot

A modern, web-controlled agricultural rover powered by dual ESP32 microcontrollers. Agro-Rover is designed to revolutionize smart farming with real-time monitoring, autonomous capabilities, and AI-driven insights. It features live video streaming, real-time GPS tracking, soil moisture sensing, automated water/fertilizer spraying, and an interactive AI-powered **AgriChatbot**. The entire system is seamlessly managed via a responsive React + Vite dashboard, synchronized in real-time through Firebase.

---

## 🚀 Tech Stack

- **Frontend Dashboard**: React 19, Vite, Leaflet Maps, Recharts, Tailwind CSS
- **Microcontrollers**: ESP32 DevKit v1 (Main Logic), AI-Thinker ESP32-CAM (Video Stream)
- **Cloud / Realtime Sync**: Firebase Realtime Database
- **AI Chatbot**: Groq API (Llama 3.3)

---

## 🛠️ Hardware & Wiring

![Circuit Diagram](./agri%20rover.png)

### 1. Main ESP32 (Control & Sensors)
The primary ESP32 handles rover mobility, water pump control, moisture sensing, GPS tracking, and servo mechanisms.

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
Dedicated entirely to processing and serving the MJPEG video stream. It publishes its local IP address directly to Firebase for the dashboard to consume.

**FTDI Wiring for Programming:**
- `U0R` (GPIO3) → FTDI `TX`
- `U0T` (GPIO1) → FTDI `RX`
- `GND` → FTDI `GND`
- `5V` → FTDI `5V` *(Must provide 5V, not 3.3V. ESP32-CAM requires high current)*
- `GPIO0` → `GND` *(Only during upload, remove to run normally)*

---

## ⚙️ Project Setup & Installation

### 1. Firebase Configuration

1. Navigate to the [Firebase Console](https://console.firebase.google.com/).
2. Create a new project (e.g., **multi-rover**).
3. Enable **Realtime Database** in Test Mode (or configure secure rules for production).
4. Register a new Web App and copy your configuration object.

### 2. Firmware Setup (Arduino IDE)

#### Prerequisites
Install the following libraries in your Arduino IDE:
- `Firebase ESP32 Client` by mobizt
- `TinyGPSPlus` by Mikal Hart
- `ESP32Servo` by Kevin Harrington

#### Main ESP32 (`firmware/esp32_main/esp32_main.ino`)
1. Open the sketch in Arduino IDE.
2. Update the credentials at the top of the file:
   ```cpp
   #define WIFI_SSID       "YOUR_WIFI_SSID"
   #define WIFI_PASSWORD   "YOUR_WIFI_PASSWORD"
   #define FIREBASE_HOST   "YOUR_PROJECT_ID.firebaseio.com"
   #define FIREBASE_AUTH   "YOUR_DATABASE_SECRET_OR_TOKEN"
   ```
3. Select board: **DOIT ESP32 DEVKIT V1**.
4. Compile and Upload.

#### ESP32-CAM (`firmware/esp32_cam/esp32_cam.ino`)
1. Open the sketch in Arduino IDE.
2. Update the WiFi and Firebase credentials exactly as you did for the main ESP32.
3. Select board: **AI Thinker ESP32-CAM**.
4. Compile and Upload *(remember to ground GPIO0 during upload, then remove and reboot)*.

### 3. Web Dashboard Setup

#### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)

#### Installation
1. Navigate to the project root:
   ```bash
   cd multi-rover
   ```
2. Install the necessary dependencies:
   ```bash
   npm install
   ```

#### Environment Configuration
1. Create a `.env` file in the root folder with the following structure:
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

#### Running the Dashboard
Start the Vite development server:
```bash
npm run dev
```
Access the dashboard at `http://localhost:5173` in your browser.

---

## 🎮 Usage Guide

- **Connection Banner:** At the top of the dashboard, you will be notified if the Main ESP32 or ESP32-CAM goes offline.
- **Rover Controls:** Use the intuitive UI buttons or your keyboard's Arrow Keys (`↑ ↓ ← →`, Space to Stop) when the rover is in Manual mode.
- **Auto Pump:** Adjust the moisture threshold slider. The rover will automatically activate the water pump if the soil moisture falls below this target value (in Auto mode).
- **Return to Base:** Click the Home icon to autonomously command the rover to head back to its designated base target.
- **Camera Feed:** The stream will auto-populate if the ESP32-CAM is online and connected to Firebase. You can also manually input the IP address if your local firewall blocks the Firebase update.
- **AgriAI Chatbot:** Click the floating `🌿 AgriAI` button to chat with the Llama-3-powered agricultural assistant. Get instant advice on crops, rover maintenance, and farming best practices.

---

**Created by:** RSMK & Jagadeesh
