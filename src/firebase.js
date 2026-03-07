// ═══════════════════════════════════════════════════════════════
//  firebase.js — Firebase configuration & realtime database
//  helpers for the Agro-Rover dashboard
// ═══════════════════════════════════════════════════════════════
import { initializeApp } from 'firebase/app'
import {
    getDatabase,
    ref,
    set,
    get,
    onValue,
    update,
    off,
} from 'firebase/database'

// ── Your Firebase project config ────────────────────────────────
// Replace these values from Firebase Console →
//   Project Settings → Your apps → SDK setup and configuration
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)
export const db = getDatabase(app)

// ── Path constants ──────────────────────────────────────────────
export const PATHS = {
    control: '/rover/control',
    sensors: '/rover/sensors',
    camera: '/rover/camera',
    status: '/rover/status',
}

// ═══════════════════════════════════════════════════════════════
//  Control helpers (write to rover)
// ═══════════════════════════════════════════════════════════════

/** Send a movement command to the rover */
export async function sendCommand(command) {
    return update(ref(db, PATHS.control), { command })
}

/** Set motor speed (0–255 PWM) */
export async function setSpeed(speed) {
    return update(ref(db, PATHS.control), { speed: Math.min(255, Math.max(0, speed)) })
}

/** Toggle pump relay on/off */
export async function setPump(on) {
    return update(ref(db, PATHS.control), { pump: on })
}

/** Set rover mode: 'AUTO' | 'MANUAL' */
export async function setMode(mode) {
    return update(ref(db, PATHS.control), { mode })
}

/** Trigger Return-to-Base */
export async function setReturnBase(active) {
    return update(ref(db, PATHS.control), {
        returnBase: active,
        command: active ? 'STOP' : 'STOP',
    })
}

/** Stop all motors immediately */
export async function emergencyStop() {
    return update(ref(db, PATHS.control), { command: 'STOP' })
}

/** Set the soil moisture threshold for auto-pump (0–100 %) */
export async function setMoistureThreshold(pct) {
    return update(ref(db, PATHS.control), { moistureThreshold: Math.min(100, Math.max(0, Math.round(pct))) })
}

/** Set the arm servo angle (0 = lowered into soil, 90 = raised) */
export async function setServoArm(angle) {
    return update(ref(db, PATHS.control), { servoArm: Math.min(180, Math.max(0, Math.round(angle))) })
}

/** Set the camera servo angle (manual target; only applied while rover is stopped) */
export async function setServoCam(angle) {
    return update(ref(db, PATHS.control), { servoCam: Math.min(180, Math.max(0, Math.round(angle))) })
}

// ═══════════════════════════════════════════════════════════════
//  Realtime listeners (read from rover)
// ═══════════════════════════════════════════════════════════════

/**
 * Subscribe to all sensor data.
 * @param {(data: object) => void} callback
 * @returns unsubscribe function
 */
export function subscribeToSensors(callback) {
    const r = ref(db, PATHS.sensors)
    onValue(r, (snap) => callback(snap.val() ?? {}))
    return () => off(r)
}

/**
 * Subscribe to camera info (stream URL).
 * @param {(data: object) => void} callback
 * @returns unsubscribe function
 */
export function subscribeToCamera(callback) {
    const r = ref(db, PATHS.camera)
    onValue(r, (snap) => callback(snap.val() ?? {}))
    return () => off(r)
}

/**
 * Subscribe to rover online status.
 * @param {(data: object) => void} callback
 * @returns unsubscribe function
 */
export function subscribeToStatus(callback) {
    const r = ref(db, PATHS.status)
    onValue(r, (snap) => callback(snap.val() ?? {}))
    return () => off(r)
}

/**
 * Subscribe to control state (to reflect current command in UI).
 * @param {(data: object) => void} callback
 * @returns unsubscribe function
 */
export function subscribeToControl(callback) {
    const r = ref(db, PATHS.control)
    onValue(r, (snap) => callback(snap.val() ?? {}))
    return () => off(r)
}

// ═══════════════════════════════════════════════════════════════
//  One-off reads
// ═══════════════════════════════════════════════════════════════
export async function getControlState() {
    const snap = await get(ref(db, PATHS.control))
    return snap.val() ?? {}
}

export async function getCameraInfo() {
    const snap = await get(ref(db, PATHS.camera))
    return snap.val() ?? {}
}
