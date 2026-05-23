'use client'

import { useState, useRef, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { ChatMessage, PostFormat } from '@/lib/types'

const QUICK_PROMPTS = [
  'Generame un guión de Reel para hoy',
  'Qué funcionó esta semana y por qué',
  'Dame 5 ideas de contenido para los próximos 7 días',
  'Mejorá este hook para el próximo Reel',
  'Analizá mis últimos posts y decime qué mejorar',
  'Armame un carrusel sobre automatización de ventas',
]

interface SaveModal {
  content: string
  title: string
  format: PostFormat
}

function ChatContent() {
  const searchParams = useSearchParams()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [saveModal, setSaveModal] = useState<SaveModal | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Pre-cargar prompt desde Banco de Ideas
  useEffect(() => {
    const ideaPrompt = searchParams.get('idea_prompt')
    if (ideaPrompt) {
      setInput(decodeURIComponent(ideaPrompt))
      textareaRef.current?.focus()
    }
  }, [searchParams])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(userMessage: string) {
    if (!userMessage.trim() || loading) return

    const newMessages: ChatMessage[] = [
      ...messages,
      { role: 'user', content: userMessage },
    ]
    setMessages(newMessages)
    setInput('')
    setLoading(true)
    setStreaming(true)

    setMessages([...newMessages, { role: 'assistant', content: '' }])

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      })

      if (!res.ok) throw new Error('Error en el servidor')

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let fullText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        fullText += decoder.decode(value, { stream: true })
        setMessages([
          ...newMessages,
          { role: 'assistant', content: fullText },
        ])
      }
    } catch {
      setMessages([
        ...newMessages,
        { role: 'assistant', content: 'Error al conectar con Claude. Revisá la API key.' },
      ])
    } finally {
      setLoading(false)
      setStreaming(false)
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

  async function handleSave() {
    if (!saveModal || !saveModal.title.trim()) return
    setSaving(true)
    await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: saveModal.title,
        format: saveModal.format,
        status: 'borrador',
        script: saveModal.content,
      }),
    })
    setSaving(false)
    setSaveModal(null)
    setSavedMsg('Borrador guardado en Biblioteca → Posts')
    setTimeout(() => setSavedMsg(null), 3000)
  }

  async function handleSaveScript(content: string) {
    const title = content.split('\n')[0]?.slice(0, 80) || 'Guión sin título'
    await fetch('/api/scripts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content, format: 'reel', status: 'pendiente' }),
    })
    setSavedMsg('Guión guardado en Biblioteca → Guiones')
    setTimeout(() => setSavedMsg(null), 3000)
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header */}
      <div className="px-6 py-4 border-b border-zinc-200 bg-white">
        <h1 className="text-sm font-semibold text-zinc-900">Chat con Claude</h1>
        <p className="text-xs text-zinc-400 mt-0.5">
          Claude lee tus métricas antes de responder — no es un chat en blanco
        </p>
      </div>

      {/* Toast guardado */}
      {savedMsg && (
        <div className="mx-6 mt-3 text-xs px-4 py-2.5 bg-green-50 border border-green-200 text-green-700 rounded-lg">
          ✓ {savedMsg}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
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
                  {streaming && isLastAssistant && msg.content !== '' && (
                    <span className="typing-cursor" />
                  )}
                </div>
                {msg.role === 'assistant' && msg.content && isComplete && (
                  <div className="self-start flex gap-2">
                    <button
                      onClick={() => handleSaveScript(msg.content)}
                      className="text-xs text-zinc-900 hover:text-zinc-700 bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 rounded-lg px-3 py-1.5 transition-colors font-medium"
                    >
                      ↓ Guardar guión
                    </button>
                    <button
                      onClick={() => openSaveModal(msg.content)}
                      className="text-xs text-zinc-400 hover:text-zinc-700 border border-zinc-200 hover:border-zinc-300 rounded-lg px-3 py-1.5 transition-colors"
                    >
                      ↓ Guardar como borrador
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
            placeholder="Pedile a Claude que genere un guión, analice tus métricas, planifique la semana..."
            rows={1}
            disabled={loading}
            className="flex-1 bg-transparent text-sm text-zinc-700 placeholder-zinc-400 resize-none outline-none max-h-40 leading-relaxed"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            className="shrink-0 w-8 h-8 rounded-xl bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-200 disabled:cursor-not-allowed text-white disabled:text-zinc-400 flex items-center justify-center transition-colors text-sm font-medium"
          >
            {loading ? '…' : '↑'}
          </button>
        </div>
        <p className="text-xs text-zinc-400 mt-2 text-center">
          Enter para enviar · Shift+Enter para nueva línea
        </p>
      </div>

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
                  <option value="foto">Foto</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setSaveModal(null)}
                className="flex-1 text-sm border border-zinc-200 hover:border-zinc-300 text-zinc-500 rounded-xl py-2.5 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={!saveModal.title.trim() || saving}
                className="flex-1 text-sm bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-200 text-white disabled:text-zinc-400 rounded-xl py-2.5 font-medium transition-colors"
              >
                {saving ? 'Guardando...' : 'Guardar'}
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
