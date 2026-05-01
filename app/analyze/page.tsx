'use client'

import { useState, useRef } from 'react'

export default function AnalyzePage() {
  const [video, setVideo] = useState<File | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [script, setScript] = useState('')
  const [loading, setLoading] = useState(false)
  const [analysis, setAnalysis] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fallback, setFallback] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFile(file: File) {
    if (file.size > 20 * 1024 * 1024) {
      setError('El video no puede superar 20MB')
      return
    }
    setVideo(file)
    setVideoUrl(URL.createObjectURL(file))
    setError(null)
    setAnalysis(null)
    setFallback(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file?.type.startsWith('video/')) handleFile(file)
  }

  async function handleAnalyze() {
    if (!video && !script) return
    setLoading(true)
    setError(null)
    setAnalysis(null)
    setFallback(false)

    if (video) {
      const formData = new FormData()
      formData.append('video', video)
      formData.append('title', title || video.name)
      if (script) formData.append('script', script)

      const res = await fetch('/api/analyze-video', { method: 'POST', body: formData })
      const data = await res.json()

      if (data.fallback) {
        setFallback(true)
      } else if (data.error) {
        setError(data.error)
      } else {
        setAnalysis(data.analysis)
        setLoading(false)
        return
      }
    }

    if (fallback || !video) {
      if (!script) {
        setError('Pegá el guión para que Claude pueda analizarlo.')
        setLoading(false)
        return
      }

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: `Analizá este guión de Reel${title ? ` titulado "${title}"` : ''} como si fuera un video completo. Dame feedback sobre: hook, estructura, ritmo de edición sugerido, entrega, CTA y puntuación 1-10 en cada categoría.\n\nGuión:\n${script}`,
            },
          ],
        }),
      })

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let fullText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        fullText += decoder.decode(value, { stream: true })
        setAnalysis(fullText)
      }
    }

    setLoading(false)
  }

  function renderAnalysis(text: string) {
    return (
      <div className="space-y-2">
        {text.split('\n').map((line, i) => {
          if (line.startsWith('**') && line.endsWith('**')) {
            return (
              <h3 key={i} className="text-sm font-semibold text-zinc-900 mt-4">
                {line.replace(/\*\*/g, '')}
              </h3>
            )
          }
          if (line.startsWith('- ')) {
            return (
              <p key={i} className="text-sm text-zinc-600 pl-3 border-l-2 border-zinc-200">
                {line.slice(2)}
              </p>
            )
          }
          if (line.trim() === '') return null
          return (
            <p key={i} className="text-sm text-zinc-500 leading-relaxed">
              {line}
            </p>
          )
        })}
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      {/* Panel izquierdo — upload */}
      <div className="w-96 border-r border-zinc-200 p-6 flex flex-col gap-5 overflow-y-auto shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">Analizar Reel</h1>
          <p className="text-xs text-zinc-400 mt-1">
            Subí tu video y Claude te da feedback sobre hook, edición y guión
          </p>
        </div>

        {/* Drop zone */}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-colors ${
            video
              ? 'border-zinc-300 bg-zinc-50'
              : 'border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          {videoUrl ? (
            <div className="space-y-2">
              <video
                src={videoUrl}
                className="w-full rounded-xl max-h-48 object-cover"
                controls
                muted
              />
              <p className="text-xs text-zinc-500 truncate">{video?.name}</p>
              <p className="text-xs text-zinc-400">
                {video ? (video.size / 1024 / 1024).toFixed(1) : 0}MB
              </p>
            </div>
          ) : (
            <div className="py-4">
              <p className="text-2xl mb-2 text-zinc-400">▶</p>
              <p className="text-sm text-zinc-500">Arrastrá tu Reel o hacé click</p>
              <p className="text-xs text-zinc-400 mt-1">MP4, MOV · máx 20MB</p>
            </div>
          )}
        </div>

        {/* Título */}
        <div>
          <label className="text-xs text-zinc-500 mb-1.5 block">Título del Reel</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej: Por qué perdés leads en WhatsApp"
            className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-zinc-400"
          />
        </div>

        {/* Guión */}
        <div>
          <label className="text-xs text-zinc-500 mb-1.5 block">
            Guión <span className="text-zinc-400">(opcional, mejora el análisis)</span>
          </label>
          <textarea
            value={script}
            onChange={(e) => setScript(e.target.value)}
            rows={6}
            placeholder="Pegá el guión que usaste en el video..."
            className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm text-zinc-700 placeholder-zinc-400 outline-none resize-none focus:border-zinc-400"
          />
        </div>

        {error && (
          <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
            {error}
          </div>
        )}

        {fallback && (
          <div className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2.5">
            Claude analizará el guión — para análisis visual del video el formato debe ser MP4.
          </div>
        )}

        <button
          onClick={handleAnalyze}
          disabled={(!video && !script) || loading}
          className="w-full bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-200 text-white disabled:text-zinc-400 rounded-xl py-3 text-sm font-medium transition-colors"
        >
          {loading ? '✦ Analizando...' : '✦ Analizar con Claude'}
        </button>

        {video && (
          <button
            onClick={() => {
              setVideo(null)
              setVideoUrl(null)
              setAnalysis(null)
              setError(null)
            }}
            className="text-xs text-zinc-400 hover:text-zinc-600 text-center"
          >
            Cambiar video
          </button>
        )}
      </div>

      {/* Panel derecho — análisis */}
      <div className="flex-1 overflow-y-auto p-6">
        {!analysis && !loading && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-zinc-50 border border-zinc-200 flex items-center justify-center text-2xl text-zinc-400">
              ▶
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-700">Subí tu Reel para analizarlo</p>
              <p className="text-xs text-zinc-400 mt-1 max-w-sm">
                Claude va a revisar el hook, el ritmo de edición, tu presencia en cámara y la estructura del guión — y te dice exactamente qué mejorar.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 max-w-sm w-full mt-2">
              {[
                '¿El hook para el scroll?',
                '¿Dónde se van los viewers?',
                '¿El CTA convierte?',
                '¿Qué reescribirías?',
              ].map((q) => (
                <div key={q} className="text-xs bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2.5 text-zinc-400">
                  {q}
                </div>
              ))}
            </div>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="w-8 h-8 border-2 border-zinc-200 border-t-zinc-700 rounded-full animate-spin" />
            <p className="text-sm text-zinc-400">Claude está viendo tu Reel...</p>
          </div>
        )}

        {analysis && (
          <div className="max-w-2xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center text-sm text-zinc-600">
                ✦
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-900">Análisis de Claude</p>
                {title && <p className="text-xs text-zinc-400">"{title}"</p>}
              </div>
              <button
                onClick={() => {
                  setAnalysis(null)
                  setVideo(null)
                  setVideoUrl(null)
                  setTitle('')
                  setScript('')
                }}
                className="ml-auto text-xs text-zinc-400 hover:text-zinc-600 border border-zinc-200 rounded-lg px-3 py-1.5"
              >
                Nuevo análisis
              </button>
            </div>

            <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-6">
              {renderAnalysis(analysis)}
            </div>

            <div className="mt-4 bg-white border border-zinc-200 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-zinc-800">¿Querés que Claude reescriba el guión?</p>
                <p className="text-xs text-zinc-400 mt-0.5">Continuá en el chat con este contexto</p>
              </div>
              <a
                href="/chat"
                className="text-xs bg-zinc-50 hover:bg-zinc-100 text-zinc-600 border border-zinc-200 rounded-lg px-4 py-2 transition-colors"
              >
                Ir al chat →
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
