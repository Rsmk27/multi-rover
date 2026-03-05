import { useEffect, useMemo, useState } from 'react'
import CropChatbot from './CropChatbot'

/* ── icons (inline SVG for zero-dependency pro feel) ── */
const IconDrone = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0" />
    <path d="M3 8l3 3M21 8l-3 3M3 16l3-3M21 16l-3-3" />
    <circle cx="3" cy="8" r="2" /><circle cx="21" cy="8" r="2" />
    <circle cx="3" cy="16" r="2" /><circle cx="21" cy="16" r="2" />
  </svg>
)
const IconThermo = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff6b6b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" /></svg>
)
const IconDrop = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" /></svg>
)
const IconMenu = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" /></svg>
)
const IconCheck = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
)
const IconHome = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
)

/* ── static log data ── */
const LOGS = [
  { time: '10:48:01', level: 'OK', message: 'Rover at Waypoint A3.4' },
  { time: '10:47:45', level: 'INFO', message: 'Soil Moisture: 45% (A3)' },
  { time: '10:47:20', level: 'INFO', message: 'Crop Health: 82 (A3)' },
  { time: '10:46:58', level: 'WARNING', message: 'Patches detected (Alert B2)' },
  { time: '10:46:30', level: 'OK', message: 'Path recalculating…' },
]

/* ── toggle switch ── */
function ToggleSwitch({ on, onToggle, label }) {
  return (
    <div className="toggle-row">
      <span className="toggle-label">{label}</span>
      <div className="toggle-group">
        <span className={`toggle-state ${on ? 'on' : 'off'}`}>{on ? 'ON' : 'OFF'}</span>
        <button
          className={`switch ${on ? 'on' : ''}`}
          onClick={onToggle}
          aria-label={`Toggle ${label}`}
        >
          <span className="switch-knob" />
        </button>
      </div>
    </div>
  )
}

/* ── SVG gauge ── */
function Gauge({ value = 45 }) {
  const angle = -90 + (value / 100) * 180
  const r = 70
  const cx = 90
  const cy = 90
  const arc = (start, end) => {
    const s = ((start - 90) * Math.PI) / 180
    const e = ((end - 90) * Math.PI) / 180
    const x1 = cx + r * Math.cos(s)
    const y1 = cy + r * Math.sin(s)
    const x2 = cx + r * Math.cos(e)
    const y2 = cy + r * Math.sin(e)
    return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`
  }
  const needleRad = ((angle - 90) * Math.PI) / 180
  const nx = cx + (r - 14) * Math.cos(needleRad)
  const ny = cy + (r - 14) * Math.sin(needleRad)

  return (
    <svg viewBox="0 0 180 120" className="gauge-svg">
      <path d={arc(-90, 90)} fill="none" stroke="#1e293b" strokeWidth="14" strokeLinecap="round" />
      <path d={arc(-90, 30)} fill="none" stroke="#22d3ee" strokeWidth="14" strokeLinecap="round" />
      <path d={arc(30, 90)} fill="none" stroke="#ef4444" strokeWidth="14" strokeLinecap="round" />
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#f8fafc" strokeWidth="3" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="5" fill="#f8fafc" />
      <text x="12" y="105" fill="#67e8f9" fontSize="11" fontWeight="600">Low</text>
      <text x="145" y="105" fill="#fca5a5" fontSize="11" fontWeight="600">High</text>
      <text x="68" y="38" fill="#fca5a5" fontSize="12" fontWeight="700">60%</text>
    </svg>
  )
}

/* ── sparkline SVG ── */
function Sparkline() {
  const points = [20, 34, 28, 42, 38, 55, 48, 60, 52, 58, 50, 46, 50, 55, 60, 54, 62, 58, 55, 52]
  const w = 200
  const h = 50
  const step = w / (points.length - 1)
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${i * step},${h - (p / 100) * h}`).join(' ')
  const fill = `${d} L${w},${h} L0,${h} Z`
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="sparkline-svg" preserveAspectRatio="none">
      <defs>
        <linearGradient id="spk" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={fill} fill="url(#spk)" />
      <path d={d} fill="none" stroke="#22d3ee" strokeWidth="2" />
    </svg>
  )
}

/* ── env wave SVG ── */
function EnvWave() {
  return (
    <svg viewBox="0 0 220 70" className="env-wave-svg" preserveAspectRatio="none">
      <defs>
        <linearGradient id="ew" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.03" />
        </linearGradient>
      </defs>
      <path d="M0 45 Q30 20, 55 35 T110 30 T165 38 T220 28 L220 70 L0 70 Z" fill="url(#ew)" />
      <path d="M0 45 Q30 20, 55 35 T110 30 T165 38 T220 28" fill="none" stroke="#22d3ee" strokeWidth="2" />
    </svg>
  )
}

/* ── Return to Base toast ── */
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

/* ════════════════════════════════════════════ */
export default function AgroRoverDashboard() {
  const [mode, setMode] = useState('AUTO')
  const [pumpOn, setPumpOn] = useState(true)
  const [sprayOn, setSprayOn] = useState(false)
  const [clock, setClock] = useState(new Date())
  const [chatOpen, setChatOpen] = useState(false)
  const [rtbActive, setRtbActive] = useState(false)
  const [rtbToast, setRtbToast] = useState(false)

  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])

  const dateStr = useMemo(
    () => clock.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
    [clock],
  )
  const timeStr = useMemo(
    () => clock.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
    [clock],
  )

  function handleReturnToBase() {
    setRtbActive(true)
    setRtbToast(true)
    setMode('AUTO')
  }
  function cancelRtb() {
    setRtbActive(false)
    setRtbToast(false)
  }

  return (
    <div className="dash-shell">
      <div className="dash-window">
        {/* ───── header ───── */}
        <header className="dash-header">
          <div className="brand-wrap">
            <span className="brand-icon"><IconDrone /></span>
            <h1>INTELLIGENT CROP MONITORING ROVER</h1>
          </div>
          <div className="header-right">
            <div className="status-pill"><span className="pulse-dot" /> {rtbActive ? 'RETURNING' : 'ONLINE'}</div>
            <time className="header-time">{dateStr} | {timeStr} IST</time>
            <div className="avatar-pill">JD</div>
          </div>
        </header>

        {/* ───── grid ───── */}
        <main className="dash-grid">
          {/* LIVE FEED */}
          <section className="card live-feed">
            <div className="card-head">
              <h2>LIVE ROVER FEED (Cam-01)</h2>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  className="ai-chat-trigger"
                  onClick={() => setChatOpen(true)}
                  title="Open AgriAI Chatbot"
                >
                  🌿 AgriAI
                </button>
                <button className="icon-btn" aria-label="Feed options"><IconMenu /></button>
              </div>
            </div>
            <div className="feed-canvas">
              <div className="feed-badge"><span className="rec-dot" /> LIVE &nbsp;(FPS: 30) Field A3-West</div>
              <div className="scan-lines" />
              {rtbActive && (
                <div className="rtb-overlay-badge">
                  <span className="rtb-pulse" />🏠 RETURNING TO BASE
                </div>
              )}
            </div>
          </section>

          {/* SOIL MOISTURE */}
          <section className="card moisture-card">
            <h2>SOIL MOISTURE</h2>
            <Gauge value={45} />
            <p className="gauge-value">45%</p>
          </section>

          {/* CROP HEALTH */}
          <section className="card health-card">
            <h2>CROP HEALTH SCORE</h2>
            <p className="score"><span>82</span>/100</p>
            <Sparkline />
            <p className="health-label"><IconCheck /> GOOD</p>
          </section>

          {/* ENVIRONMENTAL */}
          <section className="card env-card">
            <h2>ENVIRONMENTAL CONDITIONS</h2>
            <div className="env-content">
              <EnvWave />
              <div className="env-stats">
                <p>Temp: &nbsp;<strong>24.5°C</strong> <IconThermo /></p>
                <p>Humidity: &nbsp;<strong>58%</strong> <IconDrop /></p>
              </div>
            </div>
          </section>

          {/* ROVER CONTROL */}
          <section className="card rover-controls">
            <h2>ROVER CONTROL</h2>
            <div className="mode-row">
              <span>Mode Toggle:</span>
              <div className="mode-toggle">
                <button className={mode === 'AUTO' ? 'active' : ''} onClick={() => setMode('AUTO')}>AUTO</button>
                <button className={mode === 'MANUAL' ? 'active' : ''} onClick={() => setMode('MANUAL')}>Manual</button>
              </div>
            </div>
            <p className="ctrl-label">Buttons:</p>
            <div className="controls-grid">
              <button className="ctrl-btn" disabled={rtbActive}><span className="ctrl-text">Forward</span><span className="ctrl-arrow">↑</span></button>
              <button className="ctrl-btn" disabled={rtbActive}><span className="ctrl-text">Left</span><span className="ctrl-arrow">←</span></button>
              <button className="ctrl-btn" disabled={rtbActive}><span className="ctrl-text">Right</span><span className="ctrl-arrow">→</span></button>
              <button className="ctrl-btn" disabled={rtbActive}><span className="ctrl-text">Back</span><span className="ctrl-arrow">↓</span></button>
              <button className="ctrl-btn danger"><span className="ctrl-text">STOP</span><span className="ctrl-arrow stop-dot">●</span></button>
            </div>
            {/* Return to Base button */}
            <button
              className={`rtb-btn ${rtbActive ? 'rtb-btn--active' : ''}`}
              onClick={rtbActive ? cancelRtb : handleReturnToBase}
              title={rtbActive ? 'Cancel return to base' : 'Send rover back to home station'}
            >
              <IconHome />
              {rtbActive ? 'Cancel Return' : 'Return to Base'}
              {rtbActive && <span className="rtb-btn-pulse" />}
            </button>
          </section>

          {/* EQUIPMENT CONTROL */}
          <section className="card equipment-controls">
            <h2>EQUIPMENT CONTROL</h2>
            <ToggleSwitch label="Pump 💧 Toggle:" on={pumpOn} onToggle={() => setPumpOn((v) => !v)} />
            <ToggleSwitch label="Spray" on={sprayOn} onToggle={() => setSprayOn((v) => !v)} />
          </section>

          {/* LOGS */}
          <section className="card logs-card">
            <div className="card-head">
              <h2>REAL-TIME LOGS</h2>
              <button className="icon-btn" aria-label="Log options"><IconMenu /></button>
            </div>
            <div className="logs-list">
              {rtbActive && (
                <div className="log-row">
                  <span className="log-time">{timeStr}</span>
                  <span className="log-sep">-</span>
                  <span className="log-level info">INFO:</span>
                  <span className="log-msg">Return to Base initiated — navigating home</span>
                </div>
              )}
              {LOGS.map((l) => (
                <div className="log-row" key={l.time + l.message}>
                  <span className="log-time">{l.time}</span>
                  <span className="log-sep">-</span>
                  <span className={`log-level ${l.level.toLowerCase()}`}>{l.level}:</span>
                  <span className="log-msg">{l.message}</span>
                </div>
              ))}
            </div>
          </section>
        </main>
      </div>

      {/* ── Floating chatbot button ── */}
      <button
        className="fab-chat-btn"
        onClick={() => setChatOpen(true)}
        title="Open AgriAI Chatbot — Analyze Crops &amp; Chat"
        aria-label="Open crop AI chatbot"
      >
        <span className="fab-icon">🌿</span>
        <span className="fab-label">AgriAI</span>
        <span className="fab-badge">AI</span>
      </button>

      {/* ── Chatbot panel ── */}
      <CropChatbot open={chatOpen} onClose={() => setChatOpen(false)} />

      {/* ── Return to Base toast ── */}
      <ReturnToBaseToast show={rtbToast} onDismiss={() => setRtbToast(false)} />
    </div>
  )
}
