'use client'

import { useState, useRef, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { ChatMessage, PostFormat } from '@/lib/types'

const QUICK_PROMPTS = [
  'Generame 5 ideas de contenido para esta semana, con hook y por qué funcionan',
  'Armame un Reel de 60s sobre automatización de ventas con IA',
  'Dame 3 hooks para un reel sobre por qué se pierden leads',
  'Analizá mis últimos posts y decime qué mejorar',
  'Generame un carrusel sobre los errores más comunes en WhatsApp ventas',
  'Armame ideas para la próxima semana comparando con lo que hace la competencia',
]

const IDEA_STATUS_STYLE: Record<string, string> = {
  nueva: 'bg-zinc-100 text-zinc-500',
  en_proceso: 'bg-blue-50 text-blue-600',
  usada: 'bg-green-50 text-green-600',
  descartada: 'bg-red-50 text-red-500',
}

interface SaveModal {
  content: string
  title: string
  format: PostFormat
}

interface ScriptSaveModal {
  content: string
  title: string
  format: PostFormat
}

interface IdeaModal {
  content: string
  title: string
  format: PostFormat
  pain_point: string
}

interface Idea {
  id: string
  title: string
  format_suggestion: string
  status: string
  topic_tag: string | null
  created_at: string
}

const CHAT_STORAGE_KEY = 'leaderai_chat_v1'

function ChatContent() {
  const searchParams = useSearchParams()
  const [analysisBanner, setAnalysisBanner] = useState<string | null>(null)

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const saved = localStorage.getItem(CHAT_STORAGE_KEY)
      return saved ? JSON.parse(saved) : []
    } catch { return [] }
  })
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [saveModal, setSaveModal] = useState<SaveModal | null>(null)
  const [ideaModal, setIdeaModal] = useState<IdeaModal | null>(null)
  const [scriptSaveModal, setScriptSaveModal] = useState<ScriptSaveModal | null>(null)
  const [saving, setSaving] = useState(false)
  const [savingScript, setSavingScript] = useState(false)
  const [savingIdea, setSavingIdea] = useState(false)
  const [savedMsg, setSavedMsg] = useState<string | null>(null)
  const [showIdeas, setShowIdeas] = useState(false)
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [ideasLoading, setIdeasLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Guardar historial en localStorage en cada cambio
  useEffect(() => {
    if (messages.length > 0) {
      try {
        localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages))
      } catch {}
    }
  }, [messages])

  // Scroll automático solo si el usuario ya está cerca del final
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight
    if (distanceFromBottom < 180) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  useEffect(() => {
    const ideaPrompt = searchParams.get('idea_prompt')
    if (ideaPrompt) {
      setInput(decodeURIComponent(ideaPrompt))
      textareaRef.current?.focus()
    }

    const fromAnalysis = searchParams.get('from_analysis')
    if (fromAnalysis === '1') {
      try {
        const raw = sessionStorage.getItem('pending_reel_analysis')
        if (raw) {
          sessionStorage.removeItem('pending_reel_analysis')
          const { title, analysis, metrics } = JSON.parse(raw)
          const metricsLine = metrics
            ? `\nMétricas: ${metrics.plays ?? 0} plays · ${metrics.reach ?? 0} reach · ${metrics.saves ?? 0} saves · ${metrics.likes ?? 0} likes`
            : ''
          const contextMsg: ChatMessage = {
            role: 'user',
            content: `Acabo de analizar mi Reel "${title}".${metricsLine}\n\nAquí está el análisis completo:\n\n${analysis}`,
          }
          const ackMsg: ChatMessage = {
            role: 'assistant',
            content: `Entendido — tengo el análisis de "${title}" en contexto. ¿Querés que te genere el guión mejorado aplicando esos cambios, que trabajemos el hook primero, o preferís otra cosa?`,
          }
          setMessages([contextMsg, ackMsg])
          setAnalysisBanner(title)
          setInput('Generame el guión mejorado aplicando esas mejoras.')
          textareaRef.current?.focus()
        }
      } catch {}
    }
  }, [searchParams])

  useEffect(() => {
    if (showIdeas) fetchIdeas()
  }, [showIdeas])

  async function fetchIdeas() {
    setIdeasLoading(true)
    const res = await fetch('/api/content-ideas')
    const data = await res.json()
    setIdeas(data.ideas || [])
    setIdeasLoading(false)
  }

  function handleStop() {
    abortRef.current?.abort()
    setLoading(false)
    setStreaming(false)
  }

  function handleClearChat() {
    if (!confirm('¿Borrar toda la conversación?')) return
    setMessages([])
    localStorage.removeItem(CHAT_STORAGE_KEY)
  }

  async function sendMessage(userMessage: string) {
    if (!userMessage.trim() || loading) return
    const newMessages: ChatMessage[] = [...messages, { role: 'user', content: userMessage }]
    setMessages(newMessages)
    setInput('')
    setLoading(true)
    setStreaming(true)
    setMessages([...newMessages, { role: 'assistant', content: '' }])

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
        signal: controller.signal,
      })
      if (!res.ok) throw new Error('Error en el servidor')
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let fullText = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        fullText += decoder.decode(value, { stream: true })
        setMessages([...newMessages, { role: 'assistant', content: fullText }])
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        setMessages([...newMessages, { role: 'assistant', content: 'Error al conectar con Claude. Revisá la API key.' }])
      }
    } finally {
      setLoading(false)
      setStreaming(false)
      abortRef.current = null
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  function autoResize(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value)
    const ta = e.target
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px'
  }

  function openSaveModal(content: string) {
    setSaveModal({ content, title: '', format: 'reel' })
  }

  function openIdeaModal(content: string) {
    const firstLine = content.split('\n')[0]?.replace(/^#+\s*/, '').slice(0, 100) || ''
    setIdeaModal({ content, title: firstLine, format: 'reel', pain_point: '' })
  }

  async function handleSave() {
    if (!saveModal || !saveModal.title.trim()) return
    setSaving(true)
    await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: saveModal.title, format: saveModal.format, status: 'borrador', script: saveModal.content }),
    })
    setSaving(false)
    setSaveModal(null)
    setSavedMsg('Borrador guardado en Biblioteca → Posts')
    setTimeout(() => setSavedMsg(null), 3000)
  }

  function openScriptSaveModal(content: string) {
    const firstLine = content.split('\n').find(l => l.trim() && !l.startsWith('#'))?.replace(/^#+\s*/, '').slice(0, 80) || ''
    setScriptSaveModal({ content, title: firstLine, format: 'reel' })
  }

  async function handleSaveScript() {
    if (!scriptSaveModal || !scriptSaveModal.title.trim()) return
    setSavingScript(true)
    const res = await fetch('/api/scripts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: scriptSaveModal.title, content: scriptSaveModal.content, format: scriptSaveModal.format, status: 'pendiente' }),
    })
    setSavingScript(false)
    setScriptSaveModal(null)
    if (res.ok) {
      setSavedMsg('Guión guardado en Biblioteca → Guiones')
    } else {
      setSavedMsg('Error al guardar el guión')
    }
    setTimeout(() => setSavedMsg(null), 3000)
  }

  async function handleSaveIdea() {
    if (!ideaModal || !ideaModal.title.trim()) return
    setSavingIdea(true)
    await fetch('/api/content-ideas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: ideaModal.title,
        pain_point: ideaModal.pain_point,
        content_angle: ideaModal.content.slice(0, 500),
        format_suggestion: ideaModal.format,
        full_brief: ideaModal.content,
        source: 'manual',
      }),
    })
    setSavingIdea(false)
    setIdeaModal(null)
    setSavedMsg('Idea guardada en Banco de Ideas')
    setTimeout(() => setSavedMsg(null), 3000)
    if (showIdeas) fetchIdeas()
  }

  function useIdeaInChat(idea: Idea) {
    setInput(`Desarrollame esta idea en un guión completo para ${idea.format_suggestion}:\n"${idea.title}"`)
    textareaRef.current?.focus()
  }

  return (
    <div className="flex h-screen bg-white">
      {/* Chat principal */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200 bg-white flex items-center justify-between">
          <div>
            <h1 className="text-sm font-semibold text-zinc-900">Chat con Claude</h1>
            <p className="text-xs text-zinc-400 mt-0.5">Claude lee tus métricas antes de responder</p>
          </div>
          <div className="flex items-center gap-2">
            {messages.length > 0 && !loading && (
              <button
                onClick={handleClearChat}
                className="text-xs px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-400 hover:text-zinc-600 hover:border-zinc-300 transition-colors"
              >
                Nueva conversación
              </button>
            )}
            <button
              onClick={() => setShowIdeas(!showIdeas)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors flex items-center gap-1.5 ${
                showIdeas ? 'bg-zinc-900 text-white border-zinc-900' : 'border-zinc-200 text-zinc-500 hover:border-zinc-300'
              }`}
            >
              ◎ {showIdeas ? 'Ocultar ideas' : 'Banco de Ideas'}
            </button>
          </div>
        </div>

        {analysisBanner && (
          <div className="mx-6 mt-3 text-xs px-4 py-2.5 bg-zinc-900 text-white rounded-lg flex items-center justify-between">
            <span>✦ Análisis de <strong>"{analysisBanner}"</strong> cargado como contexto del agente</span>
            <button onClick={() => setAnalysisBanner(null)} className="ml-3 text-zinc-400 hover:text-white">✕</button>
          </div>
        )}

        {savedMsg && (
          <div className="mx-6 mt-3 text-xs px-4 py-2.5 bg-green-50 border border-green-200 text-green-700 rounded-lg">
            ✓ {savedMsg}
          </div>
        )}

        {/* Messages */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
              <div>
                <p className="text-zinc-700 font-medium">¿Qué generamos hoy?</p>
                <p className="text-sm text-zinc-400 mt-1 max-w-sm">
                  Claude ya sabe qué posts tuviste, cuáles funcionaron y qué recomienda para esta semana.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 max-w-xl w-full">
                {QUICK_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => sendMessage(prompt)}
                    className="text-left text-xs bg-white hover:bg-zinc-50 border border-zinc-200 hover:border-zinc-300 text-zinc-600 rounded-lg px-4 py-3 transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => {
            const isLastAssistant = msg.role === 'assistant' && i === messages.length - 1
            const isComplete = !streaming || !isLastAssistant
            return (
              <div key={i} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center text-xs shrink-0 mt-0.5 text-zinc-600">
                    ✦
                  </div>
                )}
                <div className="flex flex-col gap-1.5 max-w-2xl">
                  <div
                    className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-zinc-100 text-zinc-800 rounded-br-sm'
                        : 'bg-white border border-zinc-200 text-zinc-700 rounded-bl-sm'
                    } ${streaming && isLastAssistant && msg.content === '' ? 'typing-cursor' : ''}`}
                  >
                    {msg.content}
                    {streaming && isLastAssistant && msg.content !== '' && <span className="typing-cursor" />}
                  </div>
                  {msg.role === 'assistant' && msg.content && isComplete && (
                    <div className="self-start flex flex-wrap gap-2">
                      <button
                        onClick={() => openScriptSaveModal(msg.content)}
                        className="text-xs text-zinc-900 hover:text-zinc-700 bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 rounded-lg px-3 py-1.5 transition-colors font-medium"
                      >
                        ↓ Guardar guión
                      </button>
                      <button
                        onClick={() => openIdeaModal(msg.content)}
                        className="text-xs text-zinc-600 hover:text-zinc-900 border border-zinc-200 hover:border-zinc-300 rounded-lg px-3 py-1.5 transition-colors"
                      >
                        ◎ Guardar como idea
                      </button>
                      <button
                        onClick={() => openSaveModal(msg.content)}
                        className="text-xs text-zinc-400 hover:text-zinc-700 border border-zinc-200 hover:border-zinc-300 rounded-lg px-3 py-1.5 transition-colors"
                      >
                        ↓ Borrador
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-6 pb-6 pt-3 border-t border-zinc-200 bg-white">
          <div className="relative flex items-end gap-3 bg-zinc-50 border border-zinc-200 focus-within:border-zinc-400 rounded-2xl px-4 py-3 transition-colors">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={autoResize}
              onKeyDown={handleKeyDown}
              placeholder="Decile a Claude cuántos guiones querés, de qué tipo, con qué idea base..."
              rows={1}
              disabled={loading}
              className="flex-1 bg-transparent text-sm text-zinc-700 placeholder-zinc-400 resize-none outline-none max-h-40 leading-relaxed"
            />
            {streaming ? (
              <button
                onClick={handleStop}
                className="shrink-0 w-8 h-8 rounded-xl bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-colors text-xs font-bold"
                title="Detener respuesta"
              >
                ■
              </button>
            ) : (
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || loading}
                className="shrink-0 w-8 h-8 rounded-xl bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-200 disabled:cursor-not-allowed text-white disabled:text-zinc-400 flex items-center justify-center transition-colors text-sm font-medium"
              >
                ↑
              </button>
            )}
          </div>
          <p className="text-xs text-zinc-400 mt-2 text-center">
            Enter para enviar · Shift+Enter para nueva línea{streaming ? ' · ■ para detener' : ''}
          </p>
        </div>
      </div>

      {/* Panel lateral — Banco de Ideas */}
      {showIdeas && (
        <div className="w-72 border-l border-zinc-200 flex flex-col shrink-0">
          <div className="px-4 pt-4 pb-3 border-b border-zinc-100 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-zinc-900">Banco de Ideas</p>
              <p className="text-xs text-zinc-400 mt-0.5">{ideas.length} guardadas</p>
            </div>
            <a
              href="/ideas"
              className="text-xs text-zinc-400 hover:text-zinc-700 transition-colors"
            >
              Ver todo →
            </a>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            {ideasLoading && (
              <p className="text-xs text-zinc-400 text-center py-6">Cargando...</p>
            )}
            {!ideasLoading && ideas.length === 0 && (
              <div className="text-center py-8 px-2">
                <p className="text-xs text-zinc-500 mb-1">Sin ideas guardadas</p>
                <p className="text-xs text-zinc-400">Pedile ideas a Claude y guardá las que te gusten con "◎ Guardar como idea"</p>
              </div>
            )}
            {ideas.map((idea) => (
              <div key={idea.id} className="border border-zinc-200 rounded-xl p-3 hover:border-zinc-300 transition-colors">
                <p className="text-xs font-medium text-zinc-800 line-clamp-2 mb-2">{idea.title}</p>
                <div className="flex items-center justify-between">
                  <div className="flex gap-1.5">
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${IDEA_STATUS_STYLE[idea.status] || 'bg-zinc-100 text-zinc-400'}`}>
                      {idea.status}
                    </span>
                    <span className="text-xs text-zinc-400 bg-zinc-50 border border-zinc-200 rounded-full px-1.5 py-0.5">
                      {idea.format_suggestion}
                    </span>
                  </div>
                  <button
                    onClick={() => useIdeaInChat(idea)}
                    className="text-xs text-zinc-500 hover:text-zinc-900 transition-colors"
                    title="Usar en chat"
                  >
                    → Usar
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 border-t border-zinc-100">
            <button
              onClick={() => {
                setInput('Generame 5 ideas de contenido para esta semana para mi marca personal LeaderAI, con título, por qué duele, ángulo y 3 hooks cada una.')
                textareaRef.current?.focus()
              }}
              className="w-full text-xs bg-zinc-900 hover:bg-zinc-700 text-white rounded-xl py-2.5 font-medium transition-colors"
            >
              ✦ Generar ideas con Claude
            </button>
          </div>
        </div>
      )}

      {/* Modal guardar guión */}
      {scriptSaveModal && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-zinc-200 rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h2 className="text-base font-semibold text-zinc-900 mb-1">Guardar guión</h2>
            <p className="text-xs text-zinc-400 mb-5">Se guarda en Biblioteca → Guiones</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-zinc-500 mb-1.5 block">Título *</label>
                <input
                  type="text"
                  value={scriptSaveModal.title}
                  onChange={(e) => setScriptSaveModal({ ...scriptSaveModal, title: e.target.value })}
                  placeholder="Ej: Por qué perdés leads en WhatsApp"
                  autoFocus
                  className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-zinc-400"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1.5 block">Formato</label>
                <select
                  value={scriptSaveModal.format}
                  onChange={(e) => setScriptSaveModal({ ...scriptSaveModal, format: e.target.value as PostFormat })}
                  className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm text-zinc-700 outline-none focus:border-zinc-400"
                >
                  <option value="reel">Reel</option>
                  <option value="carrusel">Carrusel</option>
                  <option value="historia">Historia</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setScriptSaveModal(null)} className="flex-1 text-sm border border-zinc-200 hover:border-zinc-300 text-zinc-500 rounded-xl py-2.5 transition-colors">Cancelar</button>
              <button onClick={handleSaveScript} disabled={!scriptSaveModal.title.trim() || savingScript} className="flex-1 text-sm bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-200 text-white disabled:text-zinc-400 rounded-xl py-2.5 font-medium transition-colors">
                {savingScript ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal guardar en biblioteca */}
      {saveModal && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-zinc-200 rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h2 className="text-base font-semibold text-zinc-900 mb-1">Guardar en Biblioteca</h2>
            <p className="text-xs text-zinc-400 mb-5">El guión se guardará como borrador</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-zinc-500 mb-1.5 block">Título *</label>
                <input
                  type="text"
                  value={saveModal.title}
                  onChange={(e) => setSaveModal({ ...saveModal, title: e.target.value })}
                  placeholder="Ej: 3 errores que cometen los closers"
                  autoFocus
                  className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-zinc-400"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1.5 block">Formato</label>
                <select
                  value={saveModal.format}
                  onChange={(e) => setSaveModal({ ...saveModal, format: e.target.value as PostFormat })}
                  className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm text-zinc-700 outline-none focus:border-zinc-400"
                >
                  <option value="reel">Reel</option>
                  <option value="carrusel">Carrusel</option>
                  <option value="historia">Historia</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setSaveModal(null)} className="flex-1 text-sm border border-zinc-200 hover:border-zinc-300 text-zinc-500 rounded-xl py-2.5 transition-colors">Cancelar</button>
              <button onClick={handleSave} disabled={!saveModal.title.trim() || saving} className="flex-1 text-sm bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-200 text-white disabled:text-zinc-400 rounded-xl py-2.5 font-medium transition-colors">
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal guardar como idea */}
      {ideaModal && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-zinc-200 rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h2 className="text-base font-semibold text-zinc-900 mb-1">Guardar como idea</h2>
            <p className="text-xs text-zinc-400 mb-5">Se guarda en el Banco de Ideas para desarrollar después</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-zinc-500 mb-1.5 block">Título *</label>
                <input
                  type="text"
                  value={ideaModal.title}
                  onChange={(e) => setIdeaModal({ ...ideaModal, title: e.target.value })}
                  placeholder="Tema o idea central"
                  autoFocus
                  className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-zinc-400"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1.5 block">Formato</label>
                <select
                  value={ideaModal.format}
                  onChange={(e) => setIdeaModal({ ...ideaModal, format: e.target.value as PostFormat })}
                  className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm text-zinc-700 outline-none focus:border-zinc-400"
                >
                  <option value="reel">Reel</option>
                  <option value="carrusel">Carrusel</option>
                  <option value="historia">Historia</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1.5 block">Dolor / contexto (opcional)</label>
                <input
                  type="text"
                  value={ideaModal.pain_point}
                  onChange={(e) => setIdeaModal({ ...ideaModal, pain_point: e.target.value })}
                  placeholder="Por qué le importa a tu audiencia"
                  className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm text-zinc-700 placeholder-zinc-400 outline-none focus:border-zinc-400"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setIdeaModal(null)} className="flex-1 text-sm border border-zinc-200 hover:border-zinc-300 text-zinc-500 rounded-xl py-2.5 transition-colors">Cancelar</button>
              <button onClick={handleSaveIdea} disabled={!ideaModal.title.trim() || savingIdea} className="flex-1 text-sm bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-200 text-white disabled:text-zinc-400 rounded-xl py-2.5 font-medium transition-colors">
                {savingIdea ? 'Guardando...' : 'Guardar idea'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="p-6 text-xs text-zinc-400">Cargando...</div>}>
      <ChatContent />
    </Suspense>
  )
}
