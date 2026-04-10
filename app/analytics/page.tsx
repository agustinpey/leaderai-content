'use client'

import { useState, useEffect } from 'react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

interface AnalyticsData {
  posts: any[]
  summary: {
    total: number
    avgReach: number
    avgSaves: number
    avgLikes: number
    avgPlays: number
  }
  topBySaves: any[]
  topByReach: any[]
  byFormat: Record<string, { count: number; avgSaves: number; avgReach: number }>
  error?: string
}

interface WeeklyInsight {
  id: string
  week_start: string
  week_end: string
  total_posts: number
  avg_reach: number
  avg_saves: number
  recommendations: any[]
  top_format: string
  raw_analysis: string
  created_at: string
}

const FORMAT_ICON: Record<string, string> = {
  reel: '▶',
  carrusel: '⊟',
  historia: '○',
  foto: '□',
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [insights, setInsights] = useState<WeeklyInsight[]>([])
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)
  const [showMetricsModal, setShowMetricsModal] = useState(false)
  const [selectedInsight, setSelectedInsight] = useState<WeeklyInsight | null>(null)
  const [igConnected, setIgConnected] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<string | null>(null)
  const [metricsForm, setMetricsForm] = useState({
    post_id: '',
    likes: '',
    saves: '',
    reach: '',
    comments: '',
    shares: '',
    plays: '',
    retention_rate: '',
  })
  const [savingMetrics, setSavingMetrics] = useState(false)

  async function fetchData() {
    setLoading(true)
    try {
      const [analyticsRes, insightsRes, igRes] = await Promise.all([
        fetch(`/api/analytics/metrics?days=${days}`),
        fetch('/api/analytics/insights'),
        fetch('/api/integrations/status?provider=instagram'),
      ])

      const analyticsData = analyticsRes.ok ? await analyticsRes.json() : { posts: [], summary: { total: 0, avgReach: 0, avgSaves: 0, avgLikes: 0, avgPlays: 0 }, topBySaves: [], topByReach: [], byFormat: {} }
      const insightsData = insightsRes.ok ? await insightsRes.json() : []
      const igData = igRes.ok ? await igRes.json() : { connected: false }

      setData(analyticsData)
      setInsights(Array.isArray(insightsData) ? insightsData : [])
      setIgConnected(igData.connected)
    } catch {
      setData({ posts: [], summary: { total: 0, avgReach: 0, avgSaves: 0, avgLikes: 0, avgPlays: 0 }, topBySaves: [], topByReach: [], byFormat: {} })
    }
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [days])

  async function handleSaveMetrics() {
    setSavingMetrics(true)
    await fetch('/api/analytics/metrics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...metricsForm,
        likes: parseInt(metricsForm.likes) || 0,
        saves: parseInt(metricsForm.saves) || 0,
        reach: parseInt(metricsForm.reach) || 0,
        comments: parseInt(metricsForm.comments) || 0,
        shares: parseInt(metricsForm.shares) || 0,
        plays: parseInt(metricsForm.plays) || 0,
        retention_rate: parseFloat(metricsForm.retention_rate) || null,
      }),
    })
    setSavingMetrics(false)
    setShowMetricsModal(false)
    setMetricsForm({ post_id: '', likes: '', saves: '', reach: '', comments: '', shares: '', plays: '', retention_rate: '' })
    fetchData()
  }

  async function handleInstagramSync() {
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await fetch('/api/instagram/sync', { method: 'POST' })
      const result = await res.json()
      if (res.ok) {
        setSyncResult(`✓ ${result.synced} posts sincronizados desde Instagram`)
        fetchData()
      } else {
        setSyncResult(`Error: ${result.error}`)
      }
    } catch {
      setSyncResult('Error al conectar con Instagram')
    }
    setSyncing(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-xs text-zinc-600">Cargando analytics...</p>
      </div>
    )
  }

  const summary = data?.summary
  const topBySaves = data?.topBySaves || []
  const byFormat = data?.byFormat || {}

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-zinc-100">Analytics</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Métricas reales de tu cuenta</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                days === d
                  ? 'bg-zinc-100 text-zinc-900 border-zinc-100'
                  : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700'
              }`}
            >
              {d}d
            </button>
          ))}

          {igConnected ? (
            <button
              onClick={handleInstagramSync}
              disabled={syncing}
              className="text-xs bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 text-white rounded-lg px-3 py-1.5 transition-all flex items-center gap-1.5"
            >
              {syncing ? '↻ Sincronizando...' : '↻ Sync Instagram'}
            </button>
          ) : (
            <a
              href="/api/instagram/auth"
              className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-lg px-3 py-1.5 transition-colors"
            >
              Conectar Instagram
            </a>
          )}

          <button
            onClick={() => setShowMetricsModal(true)}
            className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-lg px-3 py-1.5 transition-colors"
          >
            + Cargar métricas
          </button>
        </div>
      </div>

      {/* Sync result */}
      {syncResult && (
        <div className={`mb-4 text-xs px-4 py-3 rounded-lg border ${syncResult.startsWith('✓') ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
          {syncResult}
          <button onClick={() => setSyncResult(null)} className="ml-3 opacity-50 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Sin tablas en Supabase */}
      {data?.error && (
        <div className="mb-4 text-xs px-4 py-3 bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 rounded-lg">
          Las tablas de Supabase no están creadas. Ejecutá el schema SQL en el SQL Editor de Supabase.
        </div>
      )}

      {/* Stats principales */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        {[
          { label: 'Posts', value: summary?.total || 0 },
          { label: 'Avg. Reach', value: summary?.avgReach?.toLocaleString() || '0' },
          { label: 'Avg. Saves', value: summary?.avgSaves || 0 },
          { label: 'Avg. Likes', value: summary?.avgLikes || 0 },
          { label: 'Avg. Plays', value: summary?.avgPlays?.toLocaleString() || '0' },
        ].map((s) => (
          <div key={s.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
            <p className="text-xl font-semibold text-zinc-100">{s.value}</p>
            <p className="text-xs text-zinc-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-5 mb-5">
        {/* Top por saves */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h2 className="text-sm font-medium text-zinc-100 mb-4">Top por saves</h2>
          {topBySaves.length === 0 ? (
            <p className="text-xs text-zinc-600">Sin datos aún — conectá Instagram o cargá métricas manualmente</p>
          ) : (
            <div className="space-y-3">
              {topBySaves.map((post: any, i: number) => (
                <div key={post.id} className="flex items-center gap-3">
                  <span className="text-xs text-zinc-600 w-4">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-200 truncate">{post.title}</p>
                    <p className="text-xs text-zinc-600">{post.format}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-medium text-zinc-100">{post.metrics?.saves || 0}</p>
                    <p className="text-xs text-zinc-600">saves</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Por formato */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h2 className="text-sm font-medium text-zinc-100 mb-4">Rendimiento por formato</h2>
          {Object.keys(byFormat).length === 0 ? (
            <p className="text-xs text-zinc-600">Sin datos — publicá y cargá métricas primero</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(byFormat)
                .sort(([, a]: any, [, b]: any) => b.avgSaves - a.avgSaves)
                .map(([fmt, stats]: [string, any]) => (
                  <div key={fmt} className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-zinc-800 rounded-lg flex items-center justify-center text-sm">
                      {FORMAT_ICON[fmt] || fmt[0]}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-zinc-200 capitalize">{fmt}</p>
                      <p className="text-xs text-zinc-600">{stats.count} posts</p>
                    </div>
                    <div className="text-right text-xs">
                      <p className="text-zinc-300">{stats.avgSaves} saves</p>
                      <p className="text-zinc-600">{stats.avgReach} reach</p>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Insights semanales */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-zinc-100">Análisis semanales</h2>
          <span className="text-xs text-zinc-600">Generado cada lunes a las 8am</span>
        </div>

        {insights.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-xs text-zinc-600 mb-2">No hay análisis semanales aún</p>
            <p className="text-xs text-zinc-700">El primer análisis se genera automáticamente el próximo lunes</p>
          </div>
        ) : (
          <div className="space-y-3">
            {insights.map((insight) => (
              <div
                key={insight.id}
                onClick={() => setSelectedInsight(selectedInsight?.id === insight.id ? null : insight)}
                className="border border-zinc-800 hover:border-zinc-700 rounded-xl p-4 cursor-pointer transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-zinc-200">
                    Semana del {format(parseISO(insight.week_start), 'd MMM', { locale: es })} al{' '}
                    {format(parseISO(insight.week_end), 'd MMM yyyy', { locale: es })}
                  </p>
                  <div className="flex gap-4 text-xs text-zinc-500">
                    <span>{insight.total_posts} posts</span>
                    <span>{insight.avg_saves} avg saves</span>
                    <span>{insight.avg_reach?.toLocaleString()} avg reach</span>
                  </div>
                </div>

                {selectedInsight?.id === insight.id && (
                  <div className="mt-3 pt-3 border-t border-zinc-800 space-y-3">
                    {insight.top_format && (
                      <p className="text-xs text-zinc-500">
                        Formato estrella: <span className="text-zinc-300">{insight.top_format}</span>
                      </p>
                    )}
                    {insight.recommendations?.map((rec: any, i: number) => (
                      <div key={i} className="border-l-2 border-zinc-700 pl-3">
                        <p className="text-sm text-zinc-200 font-medium">{rec.titulo}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">{rec.descripcion}</p>
                        <p className="text-xs text-zinc-600 mt-1">→ {rec.accion}</p>
                      </div>
                    ))}
                    {insight.raw_analysis && (
                      <details className="mt-2">
                        <summary className="text-xs text-zinc-600 cursor-pointer hover:text-zinc-400">Ver análisis completo</summary>
                        <div className="mt-2 text-xs text-zinc-500 whitespace-pre-wrap leading-relaxed bg-zinc-800 rounded-lg p-3 max-h-60 overflow-y-auto">
                          {insight.raw_analysis}
                        </div>
                      </details>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal cargar métricas */}
      {showMetricsModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-base font-semibold text-zinc-100 mb-2">Cargar métricas</h2>
            <p className="text-xs text-zinc-500 mb-5">
              Después de publicar, volvé acá 24h más tarde y cargá las métricas desde Instagram.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-zinc-500 mb-1.5 block">ID del post</label>
                <input
                  type="text"
                  value={metricsForm.post_id}
                  onChange={(e) => setMetricsForm({ ...metricsForm, post_id: e.target.value })}
                  placeholder="UUID del post en la biblioteca"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: 'reach', label: 'Reach' },
                  { key: 'plays', label: 'Plays (Reels)' },
                  { key: 'likes', label: 'Likes' },
                  { key: 'saves', label: 'Saves' },
                  { key: 'comments', label: 'Comentarios' },
                  { key: 'shares', label: 'Compartidos' },
                ].map((f) => (
                  <div key={f.key}>
                    <label className="text-xs text-zinc-500 mb-1.5 block">{f.label}</label>
                    <input
                      type="number"
                      value={(metricsForm as any)[f.key]}
                      onChange={(e) => setMetricsForm({ ...metricsForm, [f.key]: e.target.value })}
                      placeholder="0"
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-300 placeholder-zinc-600 outline-none focus:border-zinc-500"
                    />
                  </div>
                ))}
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1.5 block">% Retención (Reels)</label>
                <input
                  type="number"
                  step="0.1"
                  value={metricsForm.retention_rate}
                  onChange={(e) => setMetricsForm({ ...metricsForm, retention_rate: e.target.value })}
                  placeholder="42.5"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-300 placeholder-zinc-600 outline-none focus:border-zinc-500"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowMetricsModal(false)} className="flex-1 text-sm border border-zinc-700 text-zinc-400 rounded-xl py-2.5 hover:border-zinc-600">
                Cancelar
              </button>
              <button
                onClick={handleSaveMetrics}
                disabled={!metricsForm.post_id || savingMetrics}
                className="flex-1 text-sm bg-zinc-100 hover:bg-white disabled:bg-zinc-700 text-zinc-900 disabled:text-zinc-500 rounded-xl py-2.5 font-medium"
              >
                {savingMetrics ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
