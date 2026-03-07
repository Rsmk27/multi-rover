import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { translations } from './translations'
import CropChatbot from './CropChatbot'
import {
  sendCommand,
  setSpeed,
  setPump,
  setMode,
  setReturnBase,
  emergencyStop,
  setMoistureThreshold,
  setServoArm,
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

const IconExpand = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
  </svg>
)

const IconCollapse = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7" />
  </svg>
)

/* ── SVG gauge ─────────────────────────────────────────────── */
function Gauge({ value = 45, t = translations.en }) {
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
      <text x="8" y="110" fill="#ef4444" fontSize="10">{t.dry}</text>
      <text x="75" y="30" fill={color} fontSize="12" fontWeight="700">{value}%</text>
      <text x="148" y="110" fill="#22d3ee" fontSize="10">{t.wet}</text>
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
function ToggleSwitch({ on, onToggle, label, loading = false, t = translations.en }) {
  return (
    <div className="toggle-row">
      <span className="toggle-label">{label}</span>
      <div className="toggle-group">
        <span className={`toggle-state ${on ? 'on' : 'off'}`}>{on ? t.online : t.offline}</span>
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
function GpsCard({ lat, lng, valid, sats, speed, t = translations.en }) {
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
            <span>{t.acquiring}</span>
          </div>
        )}
      </div>
      <div className="gps-stats-row">
        <div className="gps-stat">
          <span>{t.satellites}</span>
          <strong className={sats >= 4 ? 'txt-green' : 'txt-yellow'}>{sats ?? '--'}</strong>
        </div>
        <div className="gps-stat">
          <span>{t.speed}</span>
          <strong className="txt-cyan">{speed ? `${speed.toFixed(1)} km/h` : '--'}</strong>
        </div>
        <div className="gps-stat">
          <span>{t.status}</span>
          <strong className={valid ? 'txt-green' : 'txt-red'}>{valid ? t.fixed : t.searching}</strong>
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
  const [lang, setLang] = useState('en')
  const t = translations[lang] || translations.en

  // ── UI state ──
  const [clock, setClock] = useState(new Date())
  const [chatOpen, setChatOpen] = useState(false)
  const [rtbToast, setRtbToast] = useState(false)
  const [cmdPending, setCmdPending] = useState(false)
  const [popupCard, setPopupCard] = useState(null)

  // ── Firebase-driven state ──
  const [sensors, setSensors] = useState({})
  const [camera, setCamera] = useState({})
  const [status, setStatus] = useState({})
  const [control, setControl] = useState({ command: 'STOP', speed: 180, pump: false, mode: 'AUTO', returnBase: false })

  const [lastRoverUpdate, setLastRoverUpdate] = useState(0)
  const [lastCamUpdate, setLastCamUpdate] = useState(0)

  // ── Manual Override ──
  const [manualIp, setManualIp] = useState('10.177.157.193')
  const [moistureHistory, setMoistureHistory] = useState([])

  const [logs, setLogs] = useState([
    { time: '--:--', level: 'INFO', message: 'Dashboard initialized — waiting for rover…' },
  ])

  const addLog = useCallback((level, message) => {
    const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    setLogs(prev => [{ time, level, message }, ...prev].slice(0, 30))
  }, [])

  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 10_000)
    return () => clearInterval(id)
  }, [])

  const dateStr = useMemo(() => clock.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }), [clock])
  const timeStr = useMemo(() => clock.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }), [clock])

  useEffect(() => {
    const unsubSensors = subscribeToSensors(data => {
      setSensors(data)
      setLastRoverUpdate(Date.now())
      if (data.soilMoisture !== undefined) {
        setMoistureHistory(prev => [...prev.slice(-19), data.soilMoisture])
      }
    })
    const unsubCamera = subscribeToCamera(data => {
      setCamera(data)
      setLastCamUpdate(Date.now())
    })
    const unsubStatus = subscribeToStatus(data => {
      setStatus(data)
      if (data.state === 'ONLINE') addLog('OK', `Rover connected — IP: ${data.ip ?? '?'}`)
    })
    const unsubControl = subscribeToControl(data => setControl(prev => ({ ...prev, ...data })))
    return () => { unsubSensors(); unsubCamera(); unsubStatus(); unsubControl() }
  }, [addLog])

  useEffect(() => {
    if (control.mode !== 'MANUAL') return
    const KEY_MAP = { ArrowUp: 'FORWARD', ArrowDown: 'BACKWARD', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT', ' ': 'STOP' }

    const isInputActive = () => {
      if (chatOpen) return true;
      const tag = document.activeElement?.tagName?.toUpperCase() || ''
      return tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable
    }

    const onDown = (e) => {
      if (isInputActive()) return;
      const cmd = KEY_MAP[e.key]
      if (cmd) { e.preventDefault(); handleCommand(cmd) }
    }
    const onUp = (e) => {
      if (isInputActive()) return;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) handleCommand('STOP')
    }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp) }
  }, [control.mode, chatOpen])

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

  async function handleThresholdChange(e) {
    const val = parseInt(e.target.value)
    try {
      await setMoistureThreshold(val)
      addLog('INFO', `Moisture threshold -> ${val}%`)
    } catch (err) { addLog('ERROR', `Threshold update failed: ${err.message}`) }
  }

  async function handleArmChange(angle) {
    try {
      await setServoArm(angle)
      addLog('INFO', `Sensor Arm -> ${angle === 0 ? 'LOWERED (0°)' : 'RAISED (90°)'}`)
    } catch (err) { addLog('ERROR', `Arm update failed: ${err.message}`) }
  }

  const now = clock.getTime()
  const roverOnline = lastRoverUpdate > 0 && (now - lastRoverUpdate < 30000)
  const camOnline = lastCamUpdate > 0 && (now - lastCamUpdate < 30000)
  const soilPct = sensors?.soilMoisture ?? 0
  const soilLabel = soilPct < 30 ? { txt: t.statusDry, cls: 'txt-red' } : soilPct < 60 ? { txt: t.statusMod, cls: 'txt-yellow' } : { txt: t.statusGood, cls: 'txt-green' }
  const uptimeLabel = sensors?.uptime ? `${Math.floor(sensors.uptime / 60)}m ${sensors.uptime % 60}s` : '--'
  const moistureThreshold = control?.moistureThreshold ?? 30
  const autoPumpActive = sensors?.autoPumpActive ?? false
  const camAngle = sensors?.camAngle ?? 90
  const pumpOn = sensors?.pumpOn ?? control?.pump ?? false
  const roverMoving = control?.command !== 'STOP' && control?.command != null

  const streamUrl = manualIp
    ? (manualIp.includes('/') ? manualIp : `http://${manualIp}/stream`)
    : (camera?.streamUrl ?? null);

  return (
    <div className="dash-shell">
      <div className="dash-window">

        <ConnectionBanner roverOnline={roverOnline} camOnline={camOnline} />

        <header className="dash-header">
          <div className="brand-wrap">
            <span className="brand-icon"><IconDrone /></span>
            <h1>{t.title}</h1>
          </div>
          <div className="header-right">
            <select value={lang} onChange={(e) => setLang(e.target.value)} className="lang-select">
              <option value="en">EN</option>
              <option value="hi">HI</option>
              <option value="te">TE</option>
            </select>
            <div className={`status-pill ${roverOnline ? '' : 'offline'}`}>
              <span className={`pulse-dot ${roverOnline ? '' : 'pulse-dot-red'}`} />
              {control.returnBase ? t.returning : roverOnline ? t.online : t.offline}
            </div>
            <div className="header-meta">
              <span className="meta-chip"><IconCam /> {camOnline ? t.camOk : t.noCam}</span>
            </div>
            <time className="header-time">{dateStr} | {timeStr} IST</time>
            <div className="avatar-pill">AR</div>
          </div>
        </header>

        <main className="dash-grid">

          <section className={`card live-feed ${popupCard === 'feed' ? 'popup-card' : ''}`}>
            <div className="card-head">
              <h2>{t.liveFeed}</h2>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder={t.enterIp}
                  value={manualIp}
                  onChange={(e) => setManualIp(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onDoubleClick={(e) => e.stopPropagation()}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    background: 'rgba(0, 0, 0, 0.25)',
                    color: '#cbd5e1',
                    fontSize: '0.75rem',
                    width: '150px',
                    outline: 'none',
                    fontFamily: 'inherit',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'rgba(34, 211, 238, 0.5)'}
                  onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'}
                />
                <button className="ai-chat-trigger" onClick={(e) => { e.stopPropagation(); setChatOpen(true); }}>🌿 {t.agriAi}</button>
                <button className="icon-btn" aria-label="Feed options" onClick={(e) => e.stopPropagation()}><IconMenu /></button>
                <button className="icon-btn" aria-label="Toggle Expand" onClick={(e) => { e.stopPropagation(); setPopupCard(popupCard === 'feed' ? null : 'feed'); }}>
                  {popupCard === 'feed' ? <IconCollapse /> : <IconExpand />}
                </button>
              </div>
            </div>
            <div className="feed-canvas">
              {streamUrl ? (
                <img
                  src={streamUrl.includes('?') ? streamUrl : `${streamUrl}?t=${new Date().getTime()}`}
                  alt="ESP32-CAM live stream"
                  className="cam-stream-img"
                />
              ) : (
                <div className="feed-no-stream">
                  <IconCam />
                  <p>{camOnline ? t.loadingStream : t.camOffline}</p>
                  {camera?.ip && <p className="feed-cam-ip">Firebase Config IP: {camera.ip}</p>}
                </div>
              )}
              <div className="feed-badge">
                <span className={`rec-dot ${camOnline ? '' : 'rec-dot-grey'}`} />
                {camOnline ? t.liveCam : t.waitingCam}
              </div>
              <div className="scan-lines" />
              {control.returnBase && (
                <div className="rtb-overlay-badge">
                  <span className="rtb-pulse" />🏠 {t.returningToBase}
                </div>
              )}
            </div>
          </section>

          <section className={`card moisture-card ${popupCard === 'moisture' ? 'popup-card' : ''}`}>
            <div className="card-head">
              <h2>{t.soilMoisture}</h2>
              <button className="icon-btn" aria-label="Toggle Expand" onClick={(e) => { e.stopPropagation(); setPopupCard(popupCard === 'moisture' ? null : 'moisture'); }}>
                {popupCard === 'moisture' ? <IconCollapse /> : <IconExpand />}
              </button>
            </div>
            <Gauge value={soilPct} t={t} />
            <p className="gauge-value">{soilPct}%</p>
            <p className={`health-label ${soilLabel.cls}`}>{soilLabel.txt}</p>
          </section>

          <section className={`card gps-card-section ${popupCard === 'gps' ? 'popup-card' : ''}`}>
            <div className="card-head">
              <h2><IconGps /> {t.gpsLocation}</h2>
              <button className="icon-btn" aria-label="Toggle Expand" onClick={(e) => { e.stopPropagation(); setPopupCard(popupCard === 'gps' ? null : 'gps'); }}>
                {popupCard === 'gps' ? <IconCollapse /> : <IconExpand />}
              </button>
            </div>
            <GpsCard
              lat={sensors?.gpsLat ?? 0}
              lng={sensors?.gpsLng ?? 0}
              valid={sensors?.gpsValid ?? false}
              sats={sensors?.gpsSats}
              t={t}
              speed={sensors?.gpsSpeed}
            />
          </section>

          <section className={`card trend-card ${popupCard === 'trend' ? 'popup-card' : ''}`}>
            <div className="card-head">
              <h2>{t.moistureTrend}</h2>
              <button className="icon-btn" aria-label="Toggle Expand" onClick={(e) => { e.stopPropagation(); setPopupCard(popupCard === 'trend' ? null : 'trend'); }}>
                {popupCard === 'trend' ? <IconCollapse /> : <IconExpand />}
              </button>
            </div>
            <Sparkline data={moistureHistory} />
            <div className="env-stats">
              <p>{t.uptime}: &nbsp;<strong>{uptimeLabel}</strong></p>
            </div>
          </section>

          <section className={`card rover-controls ${popupCard === 'rover' ? 'popup-card' : ''}`}>
            <div className="card-head">
              <h2>{t.roverControl}</h2>
              <button className="icon-btn" aria-label="Toggle Expand" onClick={(e) => { e.stopPropagation(); setPopupCard(popupCard === 'rover' ? null : 'rover'); }}>
                {popupCard === 'rover' ? <IconCollapse /> : <IconExpand />}
              </button>
            </div>

            <div className="mode-row">
              <span>{t.mode}</span>
              <div className="mode-toggle">
                <button className={control.mode === 'AUTO' ? 'active' : ''} onClick={() => handleModeToggle('AUTO')}>{t.auto}</button>
                <button className={control.mode === 'MANUAL' ? 'active' : ''} onClick={() => handleModeToggle('MANUAL')}>{t.manual}</button>
              </div>
            </div>

            <div className="speed-row">
              <span>{t.speedLbl} <strong className="txt-cyan">{control.speed ?? 180}</strong>/255</span>
              <input
                type="range" min="50" max="255" step="5"
                value={control.speed ?? 180}
                onChange={handleSpeedChange}
                className="speed-slider"
              />
            </div>

            <div className="speed-row" style={{ marginTop: 4 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>📷 {t.cam}</span>
                <strong className={roverMoving ? 'txt-yellow' : 'txt-cyan'}>{camAngle}°</strong>
                {roverMoving && <span style={{ fontSize: '0.65rem', color: '#fbbf24', animation: 'pulse 1s infinite' }}>↔ {t.sweeping}</span>}
              </span>
              <div style={{
                flex: 1,
                marginLeft: 8,
                height: 4,
                background: 'rgba(255,255,255,0.1)',
                borderRadius: 2,
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${(camAngle / 180) * 100}%`,
                  height: '100%',
                  background: roverMoving ? '#fbbf24' : '#22d3ee',
                  borderRadius: 2,
                  transition: 'width 0.1s ease'
                }} />
              </div>
            </div>

            <p className="ctrl-label">
              {t.dirControls} {control.mode === 'MANUAL' && <span className="kbd-hint">{t.arrowKeys}</span>}
            </p>
            <div className="controls-grid">
              <button className={`ctrl-btn ${control.command === 'FORWARD' ? 'ctrl-btn--active' : ''}`}
                onMouseDown={() => handleCommand('FORWARD')} onMouseUp={() => handleCommand('STOP')}
                onTouchStart={() => handleCommand('FORWARD')} onTouchEnd={() => handleCommand('STOP')}
                disabled={cmdPending || control.returnBase}>
                <span className="ctrl-text">{t.forward}</span><span className="ctrl-arrow">↑</span>
              </button>
              <button className={`ctrl-btn ${control.command === 'LEFT' ? 'ctrl-btn--active' : ''}`}
                onMouseDown={() => handleCommand('LEFT')} onMouseUp={() => handleCommand('STOP')}
                onTouchStart={() => handleCommand('LEFT')} onTouchEnd={() => handleCommand('STOP')}
                disabled={cmdPending || control.returnBase}>
                <span className="ctrl-text">{t.left}</span><span className="ctrl-arrow">←</span>
              </button>
              <button className={`ctrl-btn ${control.command === 'RIGHT' ? 'ctrl-btn--active' : ''}`}
                onMouseDown={() => handleCommand('RIGHT')} onMouseUp={() => handleCommand('STOP')}
                onTouchStart={() => handleCommand('RIGHT')} onTouchEnd={() => handleCommand('STOP')}
                disabled={cmdPending || control.returnBase}>
                <span className="ctrl-text">{t.right}</span><span className="ctrl-arrow">→</span>
              </button>
              <button className={`ctrl-btn ${control.command === 'BACKWARD' ? 'ctrl-btn--active' : ''}`}
                onMouseDown={() => handleCommand('BACKWARD')} onMouseUp={() => handleCommand('STOP')}
                onTouchStart={() => handleCommand('BACKWARD')} onTouchEnd={() => handleCommand('STOP')}
                disabled={cmdPending || control.returnBase}>
                <span className="ctrl-text">{t.back}</span><span className="ctrl-arrow">↓</span>
              </button>
              <button className="ctrl-btn danger" onClick={handleEmergencyStop}>
                <span className="ctrl-text">{t.eStop}</span><span className="ctrl-arrow stop-dot">●</span>
              </button>
            </div>

            <button
              className={`rtb-btn ${control.returnBase ? 'rtb-btn--active' : ''}`}
              onClick={handleReturnToBase}
            >
              <IconHome />
              {control.returnBase ? t.cancelReturn : t.returnToBase}
              {control.returnBase && <span className="rtb-btn-pulse" />}
            </button>
          </section>

          <section className={`card equipment-controls ${popupCard === 'equip' ? 'popup-card' : ''}`}>
            <div className="card-head">
              <h2>{t.equipControl}</h2>
              <button className="icon-btn" aria-label="Toggle Expand" onClick={(e) => { e.stopPropagation(); setPopupCard(popupCard === 'equip' ? null : 'equip'); }}>
                {popupCard === 'equip' ? <IconCollapse /> : <IconExpand />}
              </button>
            </div>

            <ToggleSwitch
              label={t.pumpSprayer}
              t={t}
              on={control.pump ?? false}
              onToggle={handlePumpToggle}
            />

            <div className="equip-status">
              <div className={`equip-indicator ${pumpOn ? 'equip-on' : 'equip-off'}`} style={{ position: 'relative' }}>
                <span>{pumpOn ? t.pumpSpraying : t.pumpIdle}</span>
                {autoPumpActive && (
                  <span style={{
                    marginLeft: 8,
                    fontSize: '0.65rem',
                    background: 'rgba(250,191,36,0.2)',
                    border: '1px solid #fbbf24',
                    borderRadius: 4,
                    padding: '1px 5px',
                    color: '#fbbf24',
                  }}>AUTO</span>
                )}
              </div>
            </div>

            <div className="speed-row" style={{ marginTop: 8, flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
              <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>{t.sensorArm}</span>
              <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                <button
                  className={`ctrl-btn ${(control.servoArm ?? 90) === 0 ? 'ctrl-btn--active' : ''}`}
                  onClick={() => handleArmChange(0)}
                  style={{ flex: 1, padding: '8px' }}
                >
                  <span style={{ color: 'white' }}>{t.lower}</span>
                </button>
                <button
                  className={`ctrl-btn ${(control.servoArm ?? 90) === 90 ? 'ctrl-btn--active' : ''}`}
                  onClick={() => handleArmChange(90)}
                  style={{ flex: 1, padding: '8px' }}
                >
                  <span style={{ color: 'white' }}>{t.raise}</span>
                </button>
              </div>
            </div>

            <div className="sensor-row">
              <span className="sensor-label">{t.rawAdc}</span>
              <span className="sensor-value txt-cyan">{sensors?.soilRaw ?? '--'}</span>
            </div>
            <div className="sensor-row">
              <span className="sensor-label">{t.soilMoisture}</span>
              <span className={`sensor-value ${soilLabel.cls}`}>{soilPct}%</span>
            </div>

            <div className="speed-row" style={{ marginTop: 8, flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
              <span style={{ fontSize: '0.75rem', display: 'flex', width: '100%', justifyContent: 'space-between' }}>
                <span style={{ opacity: 0.7 }}>{t.autoPumpThresh}</span>
                <strong className="txt-cyan">{moistureThreshold}%</strong>
              </span>
              <input
                type="range" min="0" max="100" step="5"
                value={moistureThreshold}
                onChange={handleThresholdChange}
                className="speed-slider"
                title={`Pump turns ON when moisture < ${moistureThreshold}%`}
              />
              <span style={{ fontSize: '0.65rem', opacity: 0.5, width: '100%', display: 'flex', justifyContent: 'space-between' }}>
                <span>0% ({t.never})</span>
                <span style={{ color: soilPct < moistureThreshold ? '#ef4444' : '#22d3ee' }}>
                  {soilPct < moistureThreshold ? `▲ ${t.soil} ${soilPct}% — ${t.pumpTrigger}` : `✓ ${t.soil} ${soilPct}% — ${t.sufficient}`}
                </span>
                <span>100%</span>
              </span>
            </div>

            <div className="sensor-row">
              <span className="sensor-label">{t.autoSpray}</span>
              <span className={`sensor-value ${autoPumpActive ? 'txt-yellow' : 'txt-green'}`}>
                {autoPumpActive ? t.active : control.mode === 'AUTO' ? t.armed : t.manual}
              </span>
            </div>
          </section>

          <section className={`card logs-card ${popupCard === 'logs' ? 'popup-card' : ''}`}>
            <div className="card-head">
              <h2>{t.realtimeLogs}</h2>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button className="icon-btn" onClick={() => setLogs([])} title={t.clearLogs}><IconMenu /></button>
                <button className="icon-btn" aria-label="Toggle Expand" onClick={(e) => { e.stopPropagation(); setPopupCard(popupCard === 'logs' ? null : 'logs'); }}>
                  {popupCard === 'logs' ? <IconCollapse /> : <IconExpand />}
                </button>
              </div>
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

      <button className="fab-chat-btn" onClick={() => setChatOpen(true)} title="Open AgriAI Chatbot">
        <span className="fab-icon">🌿</span>
        <span className="fab-label">AgriAI</span>
        <span className="fab-badge">AI</span>
      </button>

      <CropChatbot open={chatOpen} onClose={() => setChatOpen(false)} lang={lang} t={t} />

      <ReturnToBaseToast show={rtbToast} onDismiss={() => setRtbToast(false)} />
    </div>
  )
}
