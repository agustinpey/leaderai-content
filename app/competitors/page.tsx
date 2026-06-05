'use client'

import { useState, useEffect } from 'react'

interface Competitor {
  id: string
  username: string
  display_name: string | null
  niche: string
  follower_count: number | null
  avg_engagement_rate: number | null
  last_scraped_at: string | null
  active: boolean
  notes: string | null
  created_at: string
}

interface CompetitorPost {
  id: string
  instagram_url: string | null
  caption: string | null
  hook_text: string | null
  hashtags: string[] | null
  post_type: string | null
  likes: number
  comments: number
  plays: number | null
  engagement_rate: number | null
  published_at: string | null
  ai_topic: string | null
  ai_hook_type: string | null
  ai_cta_type: string | null
  ai_content_gap: boolean
}

export default function CompetitorsPage() {
  const [competitors, setCompetitors] = useState<Competitor[]>([])
  const [selected, setSelected] = useState<Competitor | null>(null)
  const [posts, setPosts] = useState<CompetitorPost[]>([])
  const [loading, setLoading] = useState(true)
  const [postsLoading, setPostsLoading] = useState(false)
  const [scraping, setScraping] = useState(false)
  const [scrapeRunId, setScrapeRunId] = useState<string | null>(null)
  const [scrapeDatasetId, setScrapeDatasetId] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [actionResult, setActionResult] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [filterGap, setFilterGap] = useState(false)

  useEffect(() => { fetchCompetitors() }, [])

  // Polling del run de Apify mientras está en progreso
  useEffect(() => {
    if (!scrapeRunId || !scrapeDatasetId) return
    const interval = setInterval(async () => {
      const res = await fetch(`/api/competitors/scrape?run_id=${scrapeRunId}&dataset_id=${scrapeDatasetId}`)
      const data = await res.json()
      if (data.status === 'done') {
        clearInterval(interval)
        setScraping(false)
        setScrapeRunId(null)
        setScrapeDatasetId(null)
        setActionResult(`✓ ${data.message}`)
        fetchCompetitors()
        if (selected) fetchPosts(selected.id)
      } else if (data.status === 'failed') {
        clearInterval(interval)
        setScraping(false)
        setScrapeRunId(null)
        setScrapeDatasetId(null)
        setActionResult(`Error: ${data.message}`)
      } else {
        setActionResult(`⟳ ${data.message}`)
      }
    }, 15000)
    return () => clearInterval(interval)
  }, [scrapeRunId, scrapeDatasetId, selected])

  async function fetchCompetitors() {
    setLoading(true)
    const res = await fetch('/api/competitors')
    const data = await res.json()
    setCompetitors(data.competitors || [])
    setLoading(false)
  }

  async function fetchPosts(competitorId: string) {
    setPostsLoading(true)
    const res = await fetch(`/api/competitors/${competitorId}/posts`)
    const data = await res.json()
    setPosts(data.posts || [])
    setPostsLoading(false)
  }

  function selectCompetitor(c: Competitor) {
    setSelected(c)
    fetchPosts(c.id)
  }

  async function handleAdd() {
    if (!newUsername.trim()) return
    const res = await fetch('/api/competitors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: newUsername.trim() }),
    })
    const data = await res.json()
    if (res.ok) {
      setShowAdd(false)
      setNewUsername('')
      fetchCompetitors()
    } else {
      setActionResult(`Error: ${data.error}`)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este referente?')) return
    await fetch(`/api/competitors?id=${id}`, { method: 'DELETE' })
    setSelected(null)
    setPosts([])
    fetchCompetitors()
  }

  async function handleScrape(competitorId?: string) {
    setScraping(true)
    setActionResult(null)
    const body = competitorId ? { competitor_id: competitorId } : {}
    const res = await fetch('/api/competitors/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (res.ok && data.status === 'started') {
      setScrapeRunId(data.run_id)
      setScrapeDatasetId(data.dataset_id)
      setActionResult(`⟳ ${data.message}`)
    } else {
      setScraping(false)
      setActionResult(`Error: ${data.error}`)
    }
  }

  async function handleAnalyze() {
    if (!selected) return
    setAnalyzing(true)
    setActionResult(null)
    const res = await fetch('/api/competitors/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ competitor_id: selected.id }),
    })
    const data = await res.json()
    setAnalyzing(false)
    setActionResult(res.ok ? `✓ ${data.message}` : `Error: ${data.error}`)
    fetchPosts(selected.id)
  }

  const filteredPosts = filterGap ? posts.filter((p) => p.ai_content_gap) : posts
  const gapCount = posts.filter((p) => p.ai_content_gap).length

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      {/* Sidebar izquierdo — lista de competidores */}
      <div className="w-72 border-r border-zinc-200 flex flex-col shrink-0">
        <div className="px-4 pt-5 pb-3 border-b border-zinc-100">
          <div className="flex items-center justify-between mb-1">
            <h1 className="text-base font-semibold text-zinc-900">Referentes</h1>
            <button
              onClick={() => setShowAdd(true)}
              className="w-7 h-7 rounded-lg bg-zinc-900 text-white flex items-center justify-center text-sm hover:bg-zinc-700 transition-colors"
            >
              +
            </button>
          </div>
          <p className="text-xs text-zinc-400">Cuentas de referentes a trackear</p>
        </div>

        {/* Botones globales */}
        <div className="px-4 py-3 flex gap-2 border-b border-zinc-100">
          <button
            onClick={() => handleScrape()}
            disabled={scraping || competitors.length === 0}
            className="flex-1 text-xs bg-zinc-900 hover:bg-zinc-700 disabled:bg-zinc-200 text-white disabled:text-zinc-400 rounded-lg py-2 transition-colors"
          >
            {scraping ? '↻ Scraping...' : '↻ Scrape todos'}
          </button>
          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="flex-1 text-xs bg-white hover:bg-zinc-50 disabled:opacity-50 text-zinc-700 border border-zinc-200 rounded-lg py-2 transition-colors"
          >
            {analyzing ? '✦ Analizando...' : '✦ Analizar'}
          </button>
        </div>

        {actionResult && (
          <div className={`mx-4 mt-2 text-xs px-3 py-2 rounded-lg border ${actionResult.startsWith('✓') ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
            {actionResult}
          </div>
        )}

        {/* Lista de competidores */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {loading && <p className="text-xs text-zinc-400 text-center py-4">Cargando...</p>}
          {!loading && competitors.length === 0 && (
            <p className="text-xs text-zinc-400 text-center py-8">
              Agregá referentes para empezar a trackear
            </p>
          )}
          {competitors.map((c) => (
            <button
              key={c.id}
              onClick={() => selectCompetitor(c)}
              className={`w-full text-left rounded-xl border p-3 transition-all ${
                selected?.id === c.id
                  ? 'border-zinc-900 bg-zinc-900'
                  : 'border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <p className={`text-sm font-medium ${selected?.id === c.id ? 'text-white' : 'text-zinc-900'}`}>
                  @{c.username}
                </p>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(c.id) }}
                  className={`text-xs opacity-0 group-hover:opacity-100 hover:opacity-100 ${selected?.id === c.id ? 'text-zinc-400 hover:text-red-400' : 'text-zinc-300 hover:text-red-500'}`}
                >
                  ✕
                </button>
              </div>
              {c.last_scraped_at ? (
                <p className={`text-xs mt-0.5 ${selected?.id === c.id ? 'text-zinc-400' : 'text-zinc-400'}`}>
                  Sync: {new Date(c.last_scraped_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                </p>
              ) : (
                <p className={`text-xs mt-0.5 ${selected?.id === c.id ? 'text-zinc-500' : 'text-zinc-400'}`}>
                  Sin scrape aún
                </p>
              )}
            </button>
          ))}
        </div>

        {/* Modal agregar */}
        {showAdd && (
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center z-50" onClick={() => setShowAdd(false)}>
            <div className="bg-white rounded-2xl p-5 w-72 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <p className="text-sm font-semibold text-zinc-900 mb-3">Agregar referente</p>
              <input
                autoFocus
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                placeholder="@usuario o usuario"
                className="w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-zinc-400 mb-3"
              />
              <div className="flex gap-2">
                <button onClick={handleAdd} className="flex-1 bg-zinc-900 text-white text-sm rounded-xl py-2 hover:bg-zinc-700">Agregar</button>
                <button onClick={() => setShowAdd(false)} className="flex-1 border border-zinc-200 text-zinc-600 text-sm rounded-xl py-2 hover:bg-zinc-50">Cancelar</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Panel derecho — posts del competidor */}
      <div className="flex-1 overflow-y-auto">
        {!selected && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-sm text-zinc-500">Seleccioná un referente</p>
              <p className="text-xs text-zinc-400 mt-1">Para ver sus Reels y análisis de contenido</p>
            </div>
          </div>
        )}

        {selected && (
          <div className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-semibold text-zinc-900">@{selected.username}</h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {posts.length} posts scrapeados
                  {gapCount > 0 && ` · ${gapCount} gaps de contenido`}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setFilterGap(!filterGap)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${filterGap ? 'bg-zinc-900 text-white border-zinc-900' : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50'}`}
                >
                  {filterGap ? '✓ Solo gaps' : '◎ Ver gaps'}
                </button>
                <button
                  onClick={() => handleScrape(selected.id)}
                  disabled={scraping}
                  className="text-xs bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border border-zinc-200 rounded-lg px-3 py-1.5 transition-colors"
                >
                  {scraping ? '↻...' : '↻ Scrape'}
                </button>
              </div>
            </div>

            {postsLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-zinc-200 border-t-zinc-600 rounded-full animate-spin" />
              </div>
            )}

            {!postsLoading && filteredPosts.length === 0 && (
              <div className="text-center py-12">
                <p className="text-sm text-zinc-500">
                  {filterGap ? 'No hay gaps detectados aún' : 'Sin posts. Hacé Scrape primero.'}
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 max-w-3xl">
              {filteredPosts.map((post) => (
                <div
                  key={post.id}
                  className={`border rounded-xl p-4 ${post.ai_content_gap ? 'border-emerald-200 bg-emerald-50/30' : 'border-zinc-200 bg-white'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {post.hook_text && (
                        <p className="text-sm font-medium text-zinc-900 mb-1 line-clamp-2">
                          "{post.hook_text}"
                        </p>
                      )}
                      {post.caption && !post.hook_text && (
                        <p className="text-sm text-zinc-700 mb-1 line-clamp-2">{post.caption}</p>
                      )}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {post.ai_topic && (
                          <span className="text-xs bg-zinc-100 text-zinc-600 rounded-full px-2 py-0.5">
                            {post.ai_topic}
                          </span>
                        )}
                        {post.ai_hook_type && (
                          <span className="text-xs bg-blue-50 text-blue-600 rounded-full px-2 py-0.5">
                            hook: {post.ai_hook_type}
                          </span>
                        )}
                        {post.ai_cta_type && (
                          <span className="text-xs bg-purple-50 text-purple-600 rounded-full px-2 py-0.5">
                            cta: {post.ai_cta_type}
                          </span>
                        )}
                        {post.ai_content_gap && (
                          <span className="text-xs bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5 font-medium">
                            ◎ Gap de contenido
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {post.plays != null && (
                        <p className="text-xs text-zinc-500">▶ {post.plays.toLocaleString('es-AR')}</p>
                      )}
                      <p className="text-xs text-zinc-500">♥ {post.likes.toLocaleString('es-AR')}</p>
                      {post.engagement_rate != null && (
                        <p className="text-xs text-zinc-400">{post.engagement_rate.toFixed(1)}% eng</p>
                      )}
                      {post.instagram_url && (
                        <a
                          href={post.instagram_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-zinc-400 hover:text-zinc-600 underline mt-1 block"
                        >
                          Ver →
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
