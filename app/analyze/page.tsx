'use client'

import { useState, useRef, useEffect } from 'react'

interface PostMetrics {
  likes: number
  saves: number
  reach: number
  comments: number
  shares: number
  plays: number
}

interface InstagramPost {
  id: string
  title: string
  caption: string | null
  script: string | null
  format: string
  published_at: string | null
  thumbnail_url: string | null
  metrics: PostMetrics | null
}

type Mode = 'instagram' | 'upload'

export default function AnalyzePage() {
  const [mode, setMode] = useState<Mode>('instagram')

  // Instagram mode state
  const [posts, setPosts] = useState<InstagramPost[]>([])
  const [postsLoading, setPostsLoading] = useState(false)
  const [postsError, setPostsError] = useState<string | null>(null)
  const [selectedPost, setSelectedPost] = useState<InstagramPost | null>(null)

  // Upload mode state
  const [video, setVideo] = useState<File | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [script, setScript] = useState('')
  const [fallback, setFallback] = useState(false)

  // Shared state
  const [loading, setLoading] = useState(false)
  const [analysis, setAnalysis] = useState<string | null>(null)
  const [analysisMetrics, setAnalysisMetrics] = useState<PostMetrics | null>(null)
  const [error, setError] = useState<string | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (mode === 'instagram') loadPosts()
  }, [mode])

  async function loadPosts() {
    setPostsLoading(true)
    setPostsError(null)
    try {
      const res = await fetch('/api/instagram/posts')
      const data = await res.json()
      if (data.error) {
        setPostsError(data.error)
      } else {
        setPosts(data.posts || [])
      }
    } catch {
      setPostsError('No se pudieron cargar los posts')
    } finally {
      setPostsLoading(false)
    }
  }

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

  async function handleAnalyzeInstagram() {
    if (!selectedPost) return
    setLoading(true)
    setError(null)
    setAnalysis(null)
    setAnalysisMetrics(null)

    try {
      const res = await fetch('/api/analyze-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: selectedPost.id }),
      })
      const data = await res.json()
      if (data.error) {
        setError(data.error)
      } else {
        setAnalysis(data.analysis)
        setAnalysisMetrics(data.metrics)
      }
    } catch {
      setError('Error al analizar el post')
    } finally {
      setLoading(false)
    }
  }

  async function handleAnalyzeUpload() {
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
        setLoading(false)
        return
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

  function resetAnalysis() {
    setAnalysis(null)
    setAnalysisMetrics(null)
    setError(null)
    setSelectedPost(null)
    setVideo(null)
    setVideoUrl(null)
    setTitle('')
    setScript('')
    setFallback(false)
  }

  function handleLoadIntoAgent() {
    const postTitle = selectedPost?.title || title || 'Reel subido'
    sessionStorage.setItem('pending_reel_analysis', JSON.stringify({
      title: postTitle,
      analysis: analysis!,
      metrics: analysisMetrics,
    }))
    window.location.href = '/chat?from_analysis=1'
  }

  function renderAnalysis(text: string) {
    return (
      <div className="space-y-1">
        {text.split('\n').map((line, i) => {
          if (line.startsWith('**') && line.endsWith('**')) {
            return (
              <h3 key={i} className="text-sm font-semibold text-zinc-900 mt-5 mb-1">
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
          if (line.trim() === '') return <div key={i} className="h-1" />
          return (
            <p key={i} className="text-sm text-zinc-600 leading-relaxed">
              {line}
            </p>
          )
        })}
      </div>
    )
  }

  function MetricChip({ label, value }: { label: string; value: string | number }) {
    return (
      <div className="bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-center">
        <div className="text-sm font-semibold text-zinc-900">{value}</div>
        <div className="text-xs text-zinc-400 mt-0.5">{label}</div>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      {/* Panel izquierdo */}
      <div className="w-96 border-r border-zinc-200 flex flex-col shrink-0">
        {/* Header + tabs */}
        <div className="px-5 pt-5 pb-3 border-b border-zinc-100">
          <h1 className="text-base font-semibold text-zinc-900">Analizar Reel</h1>
          <p className="text-xs text-zinc-400 mt-0.5 mb-4">
            Claude te da feedback basado en métricas reales
          </p>
          <div className="flex bg-zinc-100 rounded-xl p-1 gap-1">
            <button
              onClick={() => { setMode('instagram'); resetAnalysis() }}
              className={`flex-1 text-xs py-2 rounded-lg font-medium transition-colors ${
                mode === 'instagram'
                  ? 'bg-white text-zinc-900 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              Desde Instagram
            </button>
            <button
              onClick={() => { setMode('upload'); resetAnalysis() }}
              className={`flex-1 text-xs py-2 rounded-lg font-medium transition-colors ${
                mode === 'upload'
                  ? 'bg-white text-zinc-900 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              Subir video
            </button>
          </div>
        </div>

        {/* Contenido del panel según modo */}
        <div className="flex-1 overflow-y-auto">
          {mode === 'instagram' ? (
            <div className="p-4 space-y-3">
              {postsLoading && (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 border-zinc-200 border-t-zinc-600 rounded-full animate-spin" />
                </div>
              )}

              {postsError && (
                <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  {postsError}
                  <button
                    onClick={loadPosts}
                    className="block mt-1 text-red-600 underline"
                  >
                    Reintentar
                  </button>
                </div>
              )}

              {!postsLoading && !postsError && posts.length === 0 && (
                <div className="text-center py-12 px-4">
                  <p className="text-sm text-zinc-500">No hay posts de Instagram</p>
                  <p className="text-xs text-zinc-400 mt-1">
                    Sincronizá tu cuenta desde Integraciones o cargá métricas en Analytics.
                  </p>
                  <a
                    href="/settings"
                    className="mt-3 inline-block text-xs text-zinc-600 border border-zinc-200 rounded-lg px-3 py-1.5 hover:bg-zinc-50"
                  >
                    Ir a Integraciones →
                  </a>
                </div>
              )}

              {posts.map((post) => {
                const isSelected = selectedPost?.id === post.id
                return (
                  <button
                    key={post.id}
                    onClick={() => { setSelectedPost(post); setAnalysis(null); setError(null) }}
                    className={`w-full text-left rounded-xl border p-3.5 transition-all ${
                      isSelected
                        ? 'border-zinc-900 bg-zinc-900'
                        : 'border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Thumbnail o placeholder */}
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-base shrink-0 ${
                        isSelected ? 'bg-zinc-700' : 'bg-zinc-100'
                      }`}>
                        {post.format === 'reel' ? '▶' : post.format === 'carrusel' ? '⊟' : '◻'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-medium truncate ${isSelected ? 'text-white' : 'text-zinc-900'}`}>
                          {post.title}
                        </p>
                        {post.published_at && (
                          <p className={`text-xs mt-0.5 ${isSelected ? 'text-zinc-400' : 'text-zinc-400'}`}>
                            {new Date(post.published_at).toLocaleDateString('es-AR', {
                              day: 'numeric',
                              month: 'short',
                            })}
                          </p>
                        )}
                        {post.metrics && (
                          <div className={`flex gap-3 mt-1.5 text-xs ${isSelected ? 'text-zinc-300' : 'text-zinc-500'}`}>
                            <span>▶ {post.metrics.plays?.toLocaleString('es-AR') || 0}</span>
                            <span>♥ {post.metrics.likes || 0}</span>
                            <span>⊡ {post.metrics.saves || 0}</span>
                            <span>↗ {post.metrics.reach?.toLocaleString('es-AR') || 0}</span>
                          </div>
                        )}
                        {!post.metrics && (
                          <p className={`text-xs mt-1 ${isSelected ? 'text-zinc-500' : 'text-zinc-400'}`}>
                            Sin métricas
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="p-4 space-y-4">
              {/* Drop zone */}
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => inputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-colors ${
                  video ? 'border-zinc-300 bg-zinc-50' : 'border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50'
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
                    <video src={videoUrl} className="w-full rounded-xl max-h-40 object-cover" controls muted />
                    <p className="text-xs text-zinc-400 truncate">{video?.name}</p>
                  </div>
                ) : (
                  <div className="py-3">
                    <p className="text-xl mb-2 text-zinc-400">▶</p>
                    <p className="text-sm text-zinc-500">Arrastrá tu Reel o hacé click</p>
                    <p className="text-xs text-zinc-400 mt-1">MP4, MOV · máx 20MB</p>
                  </div>
                )}
              </div>

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

              <div>
                <label className="text-xs text-zinc-500 mb-1.5 block">
                  Guión <span className="text-zinc-400">(opcional, mejora el análisis)</span>
                </label>
                <textarea
                  value={script}
                  onChange={(e) => setScript(e.target.value)}
                  rows={5}
                  placeholder="Pegá el guión que usaste en el video..."
                  className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm text-zinc-700 placeholder-zinc-400 outline-none resize-none focus:border-zinc-400"
                />
              </div>

              {fallback && (
                <div className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2.5">
                  Claude analizará el guión — para análisis visual el formato debe ser MP4.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer con botón */}
        <div className="p-4 border-t border-zinc-100 space-y-2">
          {error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
          {mode === 'instagram' ? (
            <button
              onClick={handleAnalyzeInstagram}
              disabled={!selectedPost || loading}
              className="w-full bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-200 text-white disabled:text-zinc-400 rounded-xl py-3 text-sm font-medium transition-colors"
            >
              {loading ? '✦ Analizando...' : selectedPost ? `✦ Analizar "${selectedPost.title.slice(0, 28)}${selectedPost.title.length > 28 ? '…' : ''}"` : '✦ Seleccioná un post'}
            </button>
          ) : (
            <button
              onClick={handleAnalyzeUpload}
              disabled={(!video && !script) || loading}
              className="w-full bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-200 text-white disabled:text-zinc-400 rounded-xl py-3 text-sm font-medium transition-colors"
            >
              {loading ? '✦ Analizando...' : '✦ Analizar con Claude'}
            </button>
          )}
        </div>
      </div>

      {/* Panel derecho — análisis */}
      <div className="flex-1 overflow-y-auto p-6">
        {!analysis && !loading && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-zinc-50 border border-zinc-200 flex items-center justify-center text-2xl text-zinc-400">
              ▶
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-800">
                {mode === 'instagram' ? 'Seleccioná un post para analizar' : 'Subí tu Reel para analizarlo'}
              </p>
              <p className="text-xs text-zinc-400 mt-1 max-w-sm">
                {mode === 'instagram'
                  ? 'Claude va a cruzar tus métricas reales con el contenido y darte feedback accionable sobre qué mejorar.'
                  : 'Claude va a revisar el hook, ritmo, guión y entrega — y te dice exactamente qué cambiar.'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2.5 max-w-xs w-full mt-1">
              {[
                '¿El hook para el scroll?',
                '¿Dónde se van los viewers?',
                '¿El CTA convierte?',
                '¿Qué métricas mejorar?',
              ].map((q) => (
                <div
                  key={q}
                  className="text-xs bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2.5 text-zinc-400"
                >
                  {q}
                </div>
              ))}
            </div>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="w-8 h-8 border-2 border-zinc-200 border-t-zinc-700 rounded-full animate-spin" />
            <p className="text-sm text-zinc-400">Claude está analizando...</p>
          </div>
        )}

        {analysis && (
          <div className="max-w-2xl">
            {/* Header del análisis */}
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center text-sm text-zinc-600">
                ✦
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-900">Análisis de Claude</p>
                {(selectedPost?.title || title) && (
                  <p className="text-xs text-zinc-400">
                    "{(selectedPost?.title || title).slice(0, 50)}"
                  </p>
                )}
              </div>
              <button
                onClick={resetAnalysis}
                className="ml-auto text-xs text-zinc-400 hover:text-zinc-600 border border-zinc-200 rounded-lg px-3 py-1.5"
              >
                Nuevo análisis
              </button>
            </div>

            {/* Métricas del post analizado */}
            {analysisMetrics && (
              <div className="grid grid-cols-4 gap-2 mb-5">
                <MetricChip label="Plays" value={(analysisMetrics.plays || 0).toLocaleString('es-AR')} />
                <MetricChip label="Alcance" value={(analysisMetrics.reach || 0).toLocaleString('es-AR')} />
                <MetricChip label="Saves" value={analysisMetrics.saves || 0} />
                <MetricChip label="Likes" value={analysisMetrics.likes || 0} />
              </div>
            )}

            {/* Texto del análisis */}
            <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-6">
              {renderAnalysis(analysis)}
            </div>

            {/* CTA al chat */}
            <div className="mt-4 bg-zinc-900 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-white font-medium">¿Querés mejorar el guión?</p>
                <p className="text-xs text-zinc-400 mt-0.5">Claude recibe el análisis como contexto y generás desde ahí</p>
              </div>
              <button
                onClick={handleLoadIntoAgent}
                className="text-xs bg-white hover:bg-zinc-100 text-zinc-900 font-medium rounded-lg px-4 py-2 transition-colors shrink-0 ml-4"
              >
                ✦ Cargar en el agente
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
