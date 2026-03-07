import { useEffect, useRef, useState } from 'react'

/* ── Open-Source AI via Groq (free, CORS-friendly, open-source models) ── */
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY || ''
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

// Open-source models hosted on Groq:
const TEXT_MODEL = 'llama-3.3-70b-versatile'      // Meta Llama 3.3 – Apache 2.0
const VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct' // Llama 4 Vision – supports images

const SYSTEM_PROMPT = `You are AgriAI, an expert agricultural AI assistant integrated into an autonomous crop-monitoring rover dashboard.
You help farmers and agronomists with crop diseases, plant health, soil conditions, pest management, and best farming practices.
Be concise, practical, and use emojis for readability. Format responses with clear sections using **bold** headers.`

const VISION_SYSTEM = `You are AgriAI, an expert agricultural AI assistant. When given a crop or leaf image, analyze it and provide:
1. **Disease Detection** 🔬: Identify any visible diseases, infections, or abnormalities
2. **Health Status** 💚: Overall health assessment (Excellent/Good/Fair/Poor/Critical) with a score out of 100
3. **Symptoms** 🌡️: List visible symptoms if any
4. **Recommendations** 💊: Specific actionable advice for the farmer
5. **Urgency Level** ⚠️: Low / Medium / High / Critical

Keep the response concise, well-formatted with emojis for readability. After the analysis, invite the user to ask follow-up questions.`

/* ── helpers ── */
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result) // keep full data-URL for vision
        reader.onerror = reject
        reader.readAsDataURL(file)
    })
}

async function callGroq(messages, imageDataUrl = null, imageMime = null, lang = 'en') {
    if (!GROQ_API_KEY) throw new Error('No API key set. Add VITE_GROQ_API_KEY to your .env file.')

    let chatMessages

    if (imageDataUrl && imageMime) {
        /* ── Vision path: Llama 4 Scout ── */
        const lastMsg = messages[messages.length - 1]
        const userText = lastMsg?.content || 'Please analyze this crop image.'
        const langName = lang === 'hi' ? 'Hindi' : lang === 'te' ? 'Telugu' : 'English'
        const visionPromptWithLang = `${VISION_SYSTEM}\n\nCRITICAL RULE: You MUST respond entirely in the ${langName} language.`
        chatMessages = [
            { role: 'system', content: visionPromptWithLang },
            {
                role: 'user',
                content: [
                    {
                        type: 'image_url',
                        image_url: { url: imageDataUrl },   // full data-URL
                    },
                    { type: 'text', text: userText },
                ],
            },
        ]
    } else {
        /* ── Text path: Llama 3.3 ── */
        const lastMsg = messages[messages.length - 1]
        const langName = lang === 'hi' ? 'Hindi' : lang === 'te' ? 'Telugu' : 'English'
        const promptWithLang = `${SYSTEM_PROMPT}\n\nCRITICAL RULE: You MUST respond entirely in the ${langName} language.`
        chatMessages = [
            { role: 'system', content: promptWithLang },
            { role: 'user', content: lastMsg?.content || '' },
        ]
    }

    const model = (imageDataUrl && imageMime) ? VISION_MODEL : TEXT_MODEL

    const res = await fetch(GROQ_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${GROQ_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model,
            messages: chatMessages,
            temperature: 0.4,
            max_tokens: 1024,
        }),
    })

    if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        const msg = err?.error?.message || `API error ${res.status}`
        if (res.status === 401) throw new Error('Invalid API key — check your VITE_GROQ_API_KEY in .env')
        if (res.status === 429) throw new Error('Rate limit reached — please wait a moment and try again.')
        throw new Error(msg)
    }

    const data = await res.json()
    return data?.choices?.[0]?.message?.content?.trim() || 'No response received.'
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
export default function CropChatbot({ open, onClose, lang = 'en', t }) {
    const [messages, setMessages] = useState([
        {
            role: 'ai',
            content: t ? t.botWelcome : '🌱 **AgriAI Assistant Online**\n\nUpload a photo of your crop or leaf for instant disease detection and health analysis, or ask me anything about crop management!',
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
        const previewUrl = URL.createObjectURL(file)
        const dataUrl = await fileToBase64(file)   // full data-URL for Groq vision API
        setPendingImage({ dataUrl, mime: file.type, url: previewUrl })
        setPreviewImg(previewUrl)
    }

    /* send message / analyze image */
    async function sendMessage() {
        const text = input.trim()
        if (!text && !pendingImage) return

        const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

        // build user message
        const userMsg = {
            role: 'user',
            content: text || (lang === 'hi' ? '📸 कृपया इस फसल की छवि का विश्लेषण करें।' : lang === 'te' ? '📸 దయచేసి ఈ పంట చిత్రాన్ని విశ్లేషించండి.' : '📸 Please analyze this crop image.'),
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
            const reply = await callGroq(newMessages, img?.dataUrl, img?.mime, lang)
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
        e.stopPropagation() // Bulletproof fix: stop spacebars/arrows from reaching the global window listeners
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
                            <h3>{t ? t.botTitle : 'AgriAI Assistant'}</h3>
                            <span className="chatbot-subtitle">{t ? t.botSubtitle : 'Crop Disease & Health Analyzer'}</span>
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
                            <span>{t ? t.botDrop : '📸 Drop image here to analyze'}</span>
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
                        <div className="img-preview-label">{t ? t.botAnalyze : '🔍 Ready to analyze'}</div>
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
                        placeholder={t ? t.botPlaceholder : "Ask about crop diseases, upload a photo, or describe symptoms…"}
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
                <p className="chatbot-hint">{t ? t.botHint : '📎 Drag & drop images · Enter to send · Shift+Enter new line'}</p>
            </div>
        </div>
    )
}
