'use client'

import { useState, useRef, useEffect } from 'react'
import { ChatMessage } from '@/lib/types'

const QUICK_PROMPTS = [
  'Generame un guión de Reel para hoy',
  'Qué funcionó esta semana y por qué',
  'Dame 5 ideas de contenido para los próximos 7 días',
  'Mejorá este hook para el próximo Reel',
  'Analizá mis últimos posts y decime qué mejorar',
  'Armame un carrusel sobre automatización de ventas',
]

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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

    // Agregar mensaje vacío del asistente para ir llenando
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
    } catch (err) {
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

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="px-6 py-4 border-b border-zinc-800 bg-zinc-950">
        <h1 className="text-sm font-semibold text-zinc-100">Chat con Claude</h1>
        <p className="text-xs text-zinc-500 mt-0.5">
          Claude lee tus métricas antes de responder — no es un chat en blanco
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
            <div>
              <p className="text-zinc-300 font-medium">¿Qué generamos hoy?</p>
              <p className="text-sm text-zinc-600 mt-1 max-w-sm">
                Claude ya sabe qué posts tuviste, cuáles funcionaron y qué recomienda para esta semana.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 max-w-xl w-full">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  className="text-left text-xs bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 rounded-lg px-4 py-3 transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs shrink-0 mt-0.5">
                ✦
              </div>
            )}
            <div
              className={`max-w-2xl rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-zinc-800 text-zinc-100 rounded-br-sm'
                  : 'bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-bl-sm'
              } ${streaming && i === messages.length - 1 && msg.role === 'assistant' && msg.content === '' ? 'typing-cursor' : ''}`}
            >
              {msg.content}
              {streaming && i === messages.length - 1 && msg.role === 'assistant' && msg.content !== '' && (
                <span className="typing-cursor" />
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-6 pb-6 pt-3 border-t border-zinc-800 bg-zinc-950">
        <div className="relative flex items-end gap-3 bg-zinc-900 border border-zinc-800 focus-within:border-zinc-600 rounded-2xl px-4 py-3 transition-colors">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={autoResize}
            onKeyDown={handleKeyDown}
            placeholder="Pedile a Claude que genere un guión, analice tus métricas, planifique la semana..."
            rows={1}
            disabled={loading}
            className="flex-1 bg-transparent text-sm text-zinc-200 placeholder-zinc-600 resize-none outline-none max-h-40 leading-relaxed"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            className="shrink-0 w-8 h-8 rounded-xl bg-zinc-100 hover:bg-white disabled:bg-zinc-700 disabled:cursor-not-allowed text-zinc-900 disabled:text-zinc-500 flex items-center justify-center transition-colors text-sm font-medium"
          >
            {loading ? '…' : '↑'}
          </button>
        </div>
        <p className="text-xs text-zinc-700 mt-2 text-center">
          Enter para enviar · Shift+Enter para nueva línea
        </p>
      </div>
    </div>
  )
}
