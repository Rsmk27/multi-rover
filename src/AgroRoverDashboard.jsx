import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import CropChatbot from './CropChatbot'
import {
  sendCommand,
  setSpeed,
  setPump,
  setMode,
  setReturnBase,
  emergencyStop,
  subscribeToSensors,
  subscribeToCamera,
  subscribeToStatus,
  subscribeToControl,
} from './firebase'

/* ── icons ─────────────────────────────────────────────────── */
const IconDrone = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0" />
    <path d="M3 8l3 3M21 8l-3 3M3 16l3-3M21 16l-3-3" />
    <circle cx="3" cy="8" r="2" /><circle cx="21" cy="8" r="2" />
    <circle cx="3" cy="16" r="2" /><circle cx="21" cy="16" r="2" />
  </svg>
)
const IconThermo = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff6b6b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />
  </svg>
)
const IconDrop = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
  </svg>
)
const IconMenu = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" />
  </svg>
)
const IconCheck = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5" />
  </svg>
)
const IconHome = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
)
const IconWifi = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01" />
  </svg>
)
const IconGps = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
  </svg>
)
const IconCam = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 7l-7 5 7 5V7z" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
  </svg>
)
const IconWarning = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
)

/* ── SVG gauge ─────────────────────────────────────────────── */
function Gauge({ value = 45 }) {
  const angle = -90 + (value / 100) * 180
  const r = 70, cx = 90, cy = 90
  const arc = (start, end) => {
    const s = ((start - 90) * Math.PI) / 180
    const e = ((end - 90) * Math.PI) / 180
    return `M ${cx + r * Math.cos(s)} ${cy + r * Math.sin(s)} A ${r} ${r} 0 0 1 ${cx + r * Math.cos(e)} ${cy + r * Math.sin(e)}`
  }
  const needleRad = ((angle - 90) * Math.PI) / 180
  const nx = cx + (r - 14) * Math.cos(needleRad)
  const ny = cy + (r - 14) * Math.sin(needleRad)
  const color = value < 30 ? '#ef4444' : value < 60 ? '#fbbf24' : '#22d3ee'
  return (
    <svg viewBox="0 0 180 120" className="gauge-svg">
      <path d={arc(-90, 90)} fill="none" stroke="#1e293b" strokeWidth="14" strokeLinecap="round" />
      <path d={arc(-90, 30)} fill="none" stroke="#ef4444" strokeWidth="14" strokeLinecap="round" />
      <path d={arc(30, 60)} fill="none" stroke="#fbbf24" strokeWidth="14" strokeLinecap="round" />
      <path d={arc(60, 90)} fill="none" stroke="#22d3ee" strokeWidth="14" strokeLinecap="round" />
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#f8fafc" strokeWidth="3" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="5" fill="#f8fafc" />
      <text x="8" y="110" fill="#ef4444" fontSize="10">Dry</text>
      <text x="75" y="30" fill={color} fontSize="12" fontWeight="700">{value}%</text>
      <text x="148" y="110" fill="#22d3ee" fontSize="10">Wet</text>
    </svg>
  )
}

/* ── sparkline ──────────────────────────────────────────────── */
function Sparkline({ data = [] }) {
  const pts = data.length > 1 ? data : [40, 45, 42, 50, 55, 52, 60, 58, 62]
  const w = 200, h = 50
  const max = Math.max(...pts), min = Math.min(...pts)
  const step = w / (pts.length - 1)
  const d = pts.map((p, i) =>
    `${i === 0 ? 'M' : 'L'}${i * step},${h - ((p - min) / (max - min + 1)) * h}`
  ).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="sparkline-svg" preserveAspectRatio="none">
      <defs>
        <linearGradient id="spk" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={`${d} L${w},${h} L0,${h} Z`} fill="url(#spk)" />
      <path d={d} fill="none" stroke="#22d3ee" strokeWidth="2" />
    </svg>
  )
}

/* ── toggle switch ──────────────────────────────────────────── */
function ToggleSwitch({ on, onToggle, label, loading = false }) {
  return (
    <div className="toggle-row">
      <span className="toggle-label">{label}</span>
      <div className="toggle-group">
        <span className={`toggle-state ${on ? 'on' : 'off'}`}>{on ? 'ON' : 'OFF'}</span>
        <button
          className={`switch ${on ? 'on' : ''} ${loading ? 'switch-loading' : ''}`}
          onClick={onToggle}
          disabled={loading}
          aria-label={`Toggle ${label}`}
        >
          <span className="switch-knob" />
        </button>
      </div>
    </div>
  )
}

/* ── GPS mini-map placeholder ──────────────────────────────── */
function GpsCard({ lat, lng, valid, sats, speed }) {
  const mapsUrl = valid ? `https://www.google.com/maps?q=${lat},${lng}` : '#'
  return (
    <div className="gps-card-inner">
      <div className="gps-map-placeholder">
        {valid ? (
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="gps-map-link">
            <div className="gps-pin-dot" />
            <div className="gps-ripple" />
            <span className="gps-coords">
              {lat.toFixed(5)}°,{lng.toFixed(5)}°
            </span>
          </a>
        ) : (
          <div className="gps-no-fix">
            <IconGps />
            <span>Acquiring fix…</span>
          </div>
        )}
      </div>
      <div className="gps-stats-row">
        <div className="gps-stat">
          <span>Satellites</span>
          <strong className={sats >= 4 ? 'txt-green' : 'txt-yellow'}>{sats ?? '--'}</strong>
        </div>
        <div className="gps-stat">
          <span>Speed</span>
          <strong className="txt-cyan">{speed ? `${speed.toFixed(1)} km/h` : '--'}</strong>
        </div>
        <div className="gps-stat">
          <span>Status</span>
          <strong className={valid ? 'txt-green' : 'txt-red'}>{valid ? 'FIXED' : 'SEARCHING'}</strong>
        </div>
      </div>
    </div>
  )
}

/* ── connection status banner ───────────────────────────────── */
function ConnectionBanner({ roverOnline, camOnline }) {
  if (roverOnline && camOnline) return null
  return (
    <div className="conn-banner">
      <IconWarning />
      <span>
        {!roverOnline && !camOnline
          ? 'Rover & Camera OFFLINE — Check ESP32 WiFi / Firebase'
          : !roverOnline
            ? 'Main Rover OFFLINE — waiting for ESP32…'
            : 'Camera OFFLINE — waiting for ESP32-CAM…'}
      </span>
    </div>
  )
}

/* ── return to base toast ───────────────────────────────────── */
function ReturnToBaseToast({ show, onDismiss }) {
  useEffect(() => {
    if (!show) return
    const t = setTimeout(onDismiss, 5000)
    return () => clearTimeout(t)
  }, [show, onDismiss])
  if (!show) return null
  return (
    <div className="rtb-toast">
      <span className="rtb-icon">🏠</span>
      <div>
        <strong>Return to Base initiated</strong>
        <p>Rover navigating to home station…</p>
      </div>
      <button className="rtb-dismiss" onClick={onDismiss}>✕</button>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   MAIN DASHBOARD
───────────────────────────────────────────────────────────── */
export default function AgroRoverDashboard() {
  // ── UI state ──
  const [clock, setClock] = useState(new Date())
  const [chatOpen, setChatOpen] = useState(false)
  const [rtbToast, setRtbToast] = useState(false)
  const [cmdPending, setCmdPending] = useState(false)   // visual feedback on button press

  // ── Firebase-driven state ──
  const [sensors, setSensors] = useState({})
  const [camera, setCamera] = useState({})
  const [status, setStatus] = useState({})
  const [control, setControl] = useState({ command: 'STOP', speed: 180, pump: false, mode: 'AUTO', returnBase: false })

  // ── Moisture history (sparkline) ──
  const [moistureHistory, setMoistureHistory] = useState([])

  // ── Log entries (prepend new events) ──
  const [logs, setLogs] = useState([
    { time: '--:--', level: 'INFO', message: 'Dashboard initialized — waiting for rover…' },
  ])
  const addLog = useCallback((level, message) => {
    const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    setLogs(prev => [{ time, level, message }, ...prev].slice(0, 30))
  }, [])

  // ── Clock ──
  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 10_000)
    return () => clearInterval(id)
  }, [])

  const dateStr = useMemo(() => clock.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }), [clock])
  const timeStr = useMemo(() => clock.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }), [clock])

  // ── Firebase subscriptions ──
  useEffect(() => {
    const unsubSensors = subscribeToSensors(data => {
      setSensors(data)
      if (data.soilMoisture !== undefined) {
        setMoistureHistory(prev => [...prev.slice(-19), data.soilMoisture])
      }
    })
    const unsubCamera = subscribeToCamera(data => setCamera(data))
    const unsubStatus = subscribeToStatus(data => {
      setStatus(data)
      if (data.state === 'ONLINE') addLog('OK', `Rover connected — IP: ${data.ip ?? '?'}`)
    })
    const unsubControl = subscribeToControl(data => setControl(prev => ({ ...prev, ...data })))
    return () => { unsubSensors(); unsubCamera(); unsubStatus(); unsubControl() }
  }, [addLog])

  // ── Keyboard control (manual mode) ──
  useEffect(() => {
    if (control.mode !== 'MANUAL') return
    const KEY_MAP = { ArrowUp: 'FORWARD', ArrowDown: 'BACKWARD', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT', ' ': 'STOP' }
    const onDown = (e) => {
      const cmd = KEY_MAP[e.key]
      if (cmd) { e.preventDefault(); handleCommand(cmd) }
    }
    const onUp = (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) handleCommand('STOP')
    }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp) }
  }, [control.mode])

  // ── Command helpers ──
  async function handleCommand(cmd) {
    setCmdPending(true)
    try {
      await sendCommand(cmd)
      if (cmd !== 'STOP') addLog('OK', `Command → ${cmd}`)
    } catch (e) { addLog('ERROR', `Command failed: ${e.message}`) }
    finally { setCmdPending(false) }
  }

  async function handleEmergencyStop() {
    try {
      await emergencyStop()
      addLog('WARNING', 'EMERGENCY STOP triggered')
    } catch (e) { addLog('ERROR', `Stop failed: ${e.message}`) }
  }

  async function handlePumpToggle() {
    const newState = !control.pump
    try {
      await setPump(newState)
      addLog('INFO', `Pump → ${newState ? 'ON' : 'OFF'}`)
    } catch (e) { addLog('ERROR', `Pump toggle failed: ${e.message}`) }
  }

  async function handleModeToggle(m) {
    try {
      await setMode(m)
      addLog('INFO', `Mode → ${m}`)
    } catch (e) { addLog('ERROR', `Mode change failed: ${e.message}`) }
  }

  async function handleReturnToBase() {
    const active = !control.returnBase
    try {
      await setReturnBase(active)
      setRtbToast(active)
      addLog(active ? 'WARNING' : 'INFO', active ? 'Return to Base ACTIVATED' : 'Return to Base CANCELLED')
    } catch (e) { addLog('ERROR', `RTB failed: ${e.message}`) }
  }

  async function handleSpeedChange(e) {
    const val = parseInt(e.target.value)
    try { await setSpeed(val) } catch (_) { }
  }

  // ── Derived state ──
  const roverOnline = status?.state === 'ONLINE'
  const camOnline = camera?.status === 'ONLINE'
  const soilPct = sensors?.soilMoisture ?? 0
  const soilLabel = soilPct < 30 ? { txt: 'DRY', cls: 'txt-red' } : soilPct < 60 ? { txt: 'MODERATE', cls: 'txt-yellow' } : { txt: 'GOOD', cls: 'txt-green' }
  const rssiLabel = sensors?.rssi ? `${sensors.rssi} dBm` : '--'
  const uptimeLabel = sensors?.uptime ? `${Math.floor(sensors.uptime / 60)}m ${sensors.uptime % 60}s` : '--'
  const streamUrl = camera?.streamUrl ?? null

  return (
    <div className="dash-shell">
      <div className="dash-window">

        {/* Connection banner */}
        <ConnectionBanner roverOnline={roverOnline} camOnline={camOnline} />

        {/* ── Header ── */}
        <header className="dash-header">
          <div className="brand-wrap">
            <span className="brand-icon"><IconDrone /></span>
            <h1>INTELLIGENT AGRO-ROVER CONTROL</h1>
          </div>
          <div className="header-right">
            <div className={`status-pill ${roverOnline ? '' : 'offline'}`}>
              <span className={`pulse-dot ${roverOnline ? '' : 'pulse-dot-red'}`} />
              {control.returnBase ? 'RETURNING' : roverOnline ? 'ONLINE' : 'OFFLINE'}
            </div>
            <div className="header-meta">
              <span className="meta-chip"><IconWifi /> {rssiLabel}</span>
              <span className="meta-chip"><IconCam /> {camOnline ? 'CAM OK' : 'NO CAM'}</span>
            </div>
            <time className="header-time">{dateStr} | {timeStr} IST</time>
            <div className="avatar-pill">AR</div>
          </div>
        </header>

        {/* ── Grid ── */}
        <main className="dash-grid">

          {/* LIVE FEED */}
          <section className="card live-feed">
            <div className="card-head">
              <h2>LIVE ROVER FEED (ESP32-CAM)</h2>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button className="ai-chat-trigger" onClick={() => setChatOpen(true)}>🌿 AgriAI</button>
                <button className="icon-btn" aria-label="Feed options"><IconMenu /></button>
              </div>
            </div>
            <div className="feed-canvas">
              {streamUrl ? (
                <img
                  src={streamUrl}
                  alt="ESP32-CAM live stream"
                  className="cam-stream-img"
                  onError={() => addLog('WARNING', 'Stream connection lost')}
                />
              ) : (
                <div className="feed-no-stream">
                  <IconCam />
                  <p>{camOnline ? 'Loading stream…' : 'Camera offline'}</p>
                  {camera?.ip && <p className="feed-cam-ip">CAM IP: {camera.ip}</p>}
                </div>
              )}
              <div className="feed-badge">
                <span className={`rec-dot ${camOnline ? '' : 'rec-dot-grey'}`} />
                {camOnline ? 'LIVE · ESP32-CAM · MJPEG' : 'WAITING FOR CAM…'}
              </div>
              <div className="scan-lines" />
              {control.returnBase && (
                <div className="rtb-overlay-badge">
                  <span className="rtb-pulse" />🏠 RETURNING TO BASE
                </div>
              )}
            </div>
          </section>

          {/* SOIL MOISTURE */}
          <section className="card moisture-card">
            <h2>SOIL MOISTURE</h2>
            <Gauge value={soilPct} />
            <p className="gauge-value">{soilPct}%</p>
            <p className={`health-label ${soilLabel.cls}`}>{soilLabel.txt}</p>
          </section>

          {/* GPS */}
          <section className="card gps-card-section">
            <h2><IconGps /> GPS LOCATION</h2>
            <GpsCard
              lat={sensors?.gpsLat ?? 0}
              lng={sensors?.gpsLng ?? 0}
              valid={sensors?.gpsValid ?? false}
              sats={sensors?.gpsSats}
              speed={sensors?.gpsSpeed}
            />
          </section>

          {/* MOISTURE TREND */}
          <section className="card trend-card">
            <h2>MOISTURE TREND</h2>
            <Sparkline data={moistureHistory} />
            <div className="env-stats">
              <p>Uptime: &nbsp;<strong>{uptimeLabel}</strong></p>
              <p>Signal: &nbsp;<strong><IconWifi /> {rssiLabel}</strong></p>
            </div>
          </section>

          {/* ROVER CONTROL */}
          <section className="card rover-controls">
            <h2>ROVER CONTROL</h2>

            {/* Mode toggle */}
            <div className="mode-row">
              <span>Mode:</span>
              <div className="mode-toggle">
                <button className={control.mode === 'AUTO' ? 'active' : ''} onClick={() => handleModeToggle('AUTO')}>AUTO</button>
                <button className={control.mode === 'MANUAL' ? 'active' : ''} onClick={() => handleModeToggle('MANUAL')}>MANUAL</button>
              </div>
            </div>

            {/* Speed slider */}
            <div className="speed-row">
              <span>Speed: <strong className="txt-cyan">{control.speed ?? 180}</strong>/255</span>
              <input
                type="range" min="50" max="255" step="5"
                value={control.speed ?? 180}
                onChange={handleSpeedChange}
                className="speed-slider"
              />
            </div>

            {/* Direction buttons */}
            <p className="ctrl-label">
              Directional Controls {control.mode === 'MANUAL' && <span className="kbd-hint">· Arrow keys</span>}
            </p>
            <div className="controls-grid">
              <button className={`ctrl-btn ${control.command === 'FORWARD' ? 'ctrl-btn--active' : ''}`}
                onMouseDown={() => handleCommand('FORWARD')} onMouseUp={() => handleCommand('STOP')}
                onTouchStart={() => handleCommand('FORWARD')} onTouchEnd={() => handleCommand('STOP')}
                disabled={cmdPending || control.returnBase}>
                <span className="ctrl-text">Forward</span><span className="ctrl-arrow">↑</span>
              </button>
              <button className={`ctrl-btn ${control.command === 'LEFT' ? 'ctrl-btn--active' : ''}`}
                onMouseDown={() => handleCommand('LEFT')} onMouseUp={() => handleCommand('STOP')}
                onTouchStart={() => handleCommand('LEFT')} onTouchEnd={() => handleCommand('STOP')}
                disabled={cmdPending || control.returnBase}>
                <span className="ctrl-text">Left</span><span className="ctrl-arrow">←</span>
              </button>
              <button className={`ctrl-btn ${control.command === 'RIGHT' ? 'ctrl-btn--active' : ''}`}
                onMouseDown={() => handleCommand('RIGHT')} onMouseUp={() => handleCommand('STOP')}
                onTouchStart={() => handleCommand('RIGHT')} onTouchEnd={() => handleCommand('STOP')}
                disabled={cmdPending || control.returnBase}>
                <span className="ctrl-text">Right</span><span className="ctrl-arrow">→</span>
              </button>
              <button className={`ctrl-btn ${control.command === 'BACKWARD' ? 'ctrl-btn--active' : ''}`}
                onMouseDown={() => handleCommand('BACKWARD')} onMouseUp={() => handleCommand('STOP')}
                onTouchStart={() => handleCommand('BACKWARD')} onTouchEnd={() => handleCommand('STOP')}
                disabled={cmdPending || control.returnBase}>
                <span className="ctrl-text">Back</span><span className="ctrl-arrow">↓</span>
              </button>
              <button className="ctrl-btn danger" onClick={handleEmergencyStop}>
                <span className="ctrl-text">E-STOP</span><span className="ctrl-arrow stop-dot">●</span>
              </button>
            </div>

            {/* Return to Base */}
            <button
              className={`rtb-btn ${control.returnBase ? 'rtb-btn--active' : ''}`}
              onClick={handleReturnToBase}
            >
              <IconHome />
              {control.returnBase ? 'Cancel Return' : 'Return to Base'}
              {control.returnBase && <span className="rtb-btn-pulse" />}
            </button>
          </section>

          {/* EQUIPMENT */}
          <section className="card equipment-controls">
            <h2>EQUIPMENT CONTROL</h2>
            <ToggleSwitch
              label="💧 Pump / Sprayer"
              on={control.pump ?? false}
              onToggle={handlePumpToggle}
            />
            <div className="equip-status">
              <div className={`equip-indicator ${control.pump ? 'equip-on' : 'equip-off'}`}>
                <span>{control.pump ? '💧 Spraying Fertilizer' : '⏸ Pump Idle'}</span>
              </div>
            </div>
            <div className="sensor-row">
              <span className="sensor-label">Raw ADC</span>
              <span className="sensor-value txt-cyan">{sensors?.soilRaw ?? '--'}</span>
            </div>
            <div className="sensor-row">
              <span className="sensor-label">Moisture</span>
              <span className={`sensor-value ${soilLabel.cls}`}>{soilPct}%</span>
            </div>
            <div className="sensor-row">
              <span className="sensor-label">Auto-Spray</span>
              <span className="sensor-value txt-yellow">{soilPct < 30 && control.mode === 'AUTO' ? 'ACTIVE' : 'STANDBY'}</span>
            </div>
          </section>

          {/* LOGS */}
          <section className="card logs-card">
            <div className="card-head">
              <h2>REALTIME LOGS</h2>
              <button className="icon-btn" onClick={() => setLogs([])} title="Clear logs"><IconMenu /></button>
            </div>
            <div className="logs-list">
              {logs.map((l, i) => (
                <div className="log-row" key={i}>
                  <span className="log-time">{l.time}</span>
                  <span className="log-sep">›</span>
                  <span className={`log-level ${l.level.toLowerCase()}`}>{l.level}:</span>
                  <span className="log-msg">{l.message}</span>
                </div>
              ))}
            </div>
          </section>

        </main>
      </div>

      {/* ── Floating chatbot button ── */}
      <button className="fab-chat-btn" onClick={() => setChatOpen(true)} title="Open AgriAI Chatbot">
        <span className="fab-icon">🌿</span>
        <span className="fab-label">AgriAI</span>
        <span className="fab-badge">AI</span>
      </button>

      {/* ── Chatbot ── */}
      <CropChatbot open={chatOpen} onClose={() => setChatOpen(false)} />

      {/* ── RTB toast ── */}
      <ReturnToBaseToast show={rtbToast} onDismiss={() => setRtbToast(false)} />
    </div>
  )
}
