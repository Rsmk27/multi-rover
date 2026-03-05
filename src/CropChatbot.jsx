import { useEffect, useRef, useState } from 'react'

/* ── Gemini API integration ── */
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || ''
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`

/* ── helpers ── */
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result.split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(file)
    })
}

async function callGemini(messages, imageBase64 = null, imageMime = null) {
    const parts = []

    if (imageBase64 && imageMime) {
        parts.push({
            inline_data: { mime_type: imageMime, data: imageBase64 },
        })
        parts.push({
            text: `You are an expert agricultural AI assistant integrated into an autonomous crop-monitoring rover dashboard.
Analyze this crop/leaf image and provide:
1. **Disease Detection**: Identify any visible diseases, infections, or abnormalities
2. **Health Status**: Overall health assessment (Excellent/Good/Fair/Poor/Critical) with a score out of 100
3. **Symptoms**: List visible symptoms if any
4. **Recommendations**: Specific actionable advice for the farmer
5. **Urgency Level**: Low/Medium/High/Critical

Keep the response concise, well-formatted with clear sections and emojis for readability. 
After the analysis, invite the user to ask follow-up questions about the crop.`,
        })
    } else {
        const lastMsg = messages[messages.length - 1]
        parts.push({
            text: `You are an expert agricultural AI assistant integrated into an autonomous crop-monitoring rover dashboard.
You help farmers and agronomists with crop diseases, plant health, soil conditions, pest management, and best farming practices.
Be concise, practical, and use emojis for readability. 
Current question: ${lastMsg?.content || ''}`,
        })
    }

    const body = {
        contents: [{ parts }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 1024 },
    }

    const res = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })

    if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error?.message || `API error ${res.status}`)
    }

    const data = await res.json()
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response received.'
}

/* ── message bubble ── */
function Bubble({ msg }) {
    const isUser = msg.role === 'user'
    return (
        <div className={`chat-bubble ${isUser ? 'user-bubble' : 'ai-bubble'}`}>
            {!isUser && (
                <span className="ai-avatar" title="AgriAI">
                    🌿
                </span>
            )}
            <div className="bubble-inner">
                {msg.image && (
                    <div className="bubble-img-wrap">
                        <img src={msg.image} alt="Uploaded crop" className="bubble-img" />
                    </div>
                )}
                <div
                    className="bubble-text"
                    dangerouslySetInnerHTML={{
                        __html: msg.content
                            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                            .replace(/\n/g, '<br/>'),
                    }}
                />
                <span className="bubble-time">{msg.time}</span>
            </div>
        </div>
    )
}

/* ── quick suggestion chips ── */
const QUICK_SUGGESTIONS = [
    '🌾 How to identify wheat rust?',
    '🍂 Yellowing leaves causes',
    '🐛 Common pests this season',
    '💧 Optimal irrigation tips',
    '🌡️ Temperature stress symptoms',
]

/* ════════ Main CropChatbot component ════════ */
export default function CropChatbot({ open, onClose }) {
    const [messages, setMessages] = useState([
        {
            role: 'ai',
            content:
                '🌱 **AgriAI Assistant Online**\n\nUpload a photo of your crop or leaf for instant disease detection and health analysis, or ask me anything about crop management!\n\n📸 **Tip:** Clear, close-up photos give the best analysis results.',
            time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        },
    ])
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const [dragOver, setDragOver] = useState(false)
    const [previewImg, setPreviewImg] = useState(null)
    const [pendingImage, setPendingImage] = useState(null) // { base64, mime, url }
    const fileInputRef = useRef(null)
    const bottomRef = useRef(null)
    const textareaRef = useRef(null)

    useEffect(() => {
        if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages, open])

    useEffect(() => {
        if (open) textareaRef.current?.focus()
    }, [open])

    /* handle file selection */
    async function handleFile(file) {
        if (!file || !file.type.startsWith('image/')) return
        const url = URL.createObjectURL(file)
        const b64 = await fileToBase64(file)
        setPendingImage({ base64: b64, mime: file.type, url })
        setPreviewImg(url)
    }

    /* send message / analyze image */
    async function sendMessage() {
        const text = input.trim()
        if (!text && !pendingImage) return

        const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

        // build user message
        const userMsg = {
            role: 'user',
            content: text || '📸 Please analyze this crop image.',
            image: pendingImage?.url || null,
            time: now,
        }

        const newMessages = [...messages, userMsg]
        setMessages(newMessages)
        setInput('')
        const img = pendingImage
        setPendingImage(null)
        setPreviewImg(null)
        setLoading(true)

        try {
            const reply = await callGemini(newMessages, img?.base64, img?.mime)
            setMessages((prev) => [
                ...prev,
                {
                    role: 'ai',
                    content: reply,
                    time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                },
            ])
        } catch (err) {
            setMessages((prev) => [
                ...prev,
                {
                    role: 'ai',
                    content: `⚠️ **Error:** ${err.message}\n\nPlease check your API key or try again.`,
                    time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                },
            ])
        } finally {
            setLoading(false)
        }
    }

    function handleKeyDown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            sendMessage()
        }
    }

    function handleDrop(e) {
        e.preventDefault()
        setDragOver(false)
        const file = e.dataTransfer.files[0]
        handleFile(file)
    }

    function clearPending() {
        setPendingImage(null)
        setPreviewImg(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    function useSuggestion(s) {
        setInput(s.replace(/^[^\s]+ /, ''))
        textareaRef.current?.focus()
    }

    if (!open) return null

    return (
        <div className="chatbot-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="chatbot-panel">
                {/* header */}
                <div className="chatbot-header">
                    <div className="chatbot-brand">
                        <span className="chatbot-icon">🌿</span>
                        <div>
                            <h3>AgriAI Assistant</h3>
                            <span className="chatbot-subtitle">Crop Disease &amp; Health Analyzer</span>
                        </div>
                    </div>
                    <div className="chatbot-header-actions">
                        <span className="chatbot-online-dot" />
                        <button
                            className="chatbot-close"
                            onClick={onClose}
                            aria-label="Close chatbot"
                            title="Close"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                {/* messages */}
                <div
                    className={`chatbot-messages ${dragOver ? 'drag-active' : ''}`}
                    onDragOver={(e) => {
                        e.preventDefault()
                        setDragOver(true)
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                >
                    {dragOver && (
                        <div className="drop-overlay">
                            <span>📸 Drop image here to analyze</span>
                        </div>
                    )}
                    {messages.map((msg, i) => (
                        <Bubble key={i} msg={msg} />
                    ))}
                    {loading && (
                        <div className="chat-bubble ai-bubble">
                            <span className="ai-avatar">🌿</span>
                            <div className="bubble-inner">
                                <div className="typing-indicator">
                                    <span /><span /><span />
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={bottomRef} />
                </div>

                {/* quick suggestions (only show when few messages) */}
                {messages.length <= 2 && (
                    <div className="quick-suggestions">
                        {QUICK_SUGGESTIONS.map((s) => (
                            <button key={s} className="suggestion-chip" onClick={() => useSuggestion(s)}>
                                {s}
                            </button>
                        ))}
                    </div>
                )}

                {/* image preview strip */}
                {previewImg && (
                    <div className="img-preview-strip">
                        <img src={previewImg} alt="To analyze" />
                        <div className="img-preview-label">🔍 Ready to analyze</div>
                        <button className="img-preview-remove" onClick={clearPending} title="Remove image">
                            ✕
                        </button>
                    </div>
                )}

                {/* input area */}
                <div className="chatbot-input-area">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden-file-input"
                        onChange={(e) => handleFile(e.target.files[0])}
                    />
                    <button
                        className="attach-btn"
                        onClick={() => fileInputRef.current?.click()}
                        title="Upload crop/leaf image"
                        disabled={loading}
                    >
                        📸
                    </button>
                    <textarea
                        ref={textareaRef}
                        className="chat-textarea"
                        placeholder="Ask about crop diseases, upload a photo, or describe symptoms…"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        rows={1}
                        disabled={loading}
                    />
                    <button
                        className="send-btn"
                        onClick={sendMessage}
                        disabled={loading || (!input.trim() && !pendingImage)}
                        title="Send (Enter)"
                    >
                        {loading ? (
                            <span className="send-spinner" />
                        ) : (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                            </svg>
                        )}
                    </button>
                </div>
                <p className="chatbot-hint">📎 Drag &amp; drop images · Enter to send · Shift+Enter new line</p>
            </div>
        </div>
    )
}
