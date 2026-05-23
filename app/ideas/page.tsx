'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import IdeaCard from '@/components/IdeaCard'

interface ContentIdea {
  id: string
  title: string
  pain_point: string
  content_angle: string
  format_suggestion: string
  topic_tag: string | null
  estimated_performance: 'bajo' | 'medio' | 'alto' | 'viral'
  hooks: string[] | null
  source: string
  status: 'nueva' | 'en_proceso' | 'usada' | 'descartada'
  full_brief: string | null
  generation_batch_id: string | null
  created_at: string
}

interface LastRun {
  id: string
  status: string
  ideas_generated: number
  completed_at: string | null
}

const TOPIC_LABELS: Record<string, string> = {
  ai_agents: 'Agentes IA',
  crm_automation: 'CRM / Automatización',
  database_ops: 'Base de datos',
  concesionarias: 'Concesionarias',
  founder_growth: 'Crecimiento founder',
  lead_conversion: 'Conversión leads',
}

export default function IdeasPage() {
  const router = useRouter()
  const [ideas, setIdeas] = useState<ContentIdea[]>([])
  const [lastRun, setLastRun] = useState<LastRun | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [generateResult, setGenerateResult] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [briefs, setBriefs] = useState<Record<string, string>>({})
  const [briefLoading, setBriefLoading] = useState<string | null>(null)

  const [filterStatus, setFilterStatus] = useState<string>('todas')
  const [filterTopic, setFilterTopic] = useState<string>('todos')
  const [filterPerf, setFilterPerf] = useState<string>('todos')

  useEffect(() => { fetchIdeas(); fetchLastRun() }, [])

  async function fetchIdeas() {
    setLoading(true)
    const res = await fetch('/api/content-ideas')
    const data = await res.json()
    setIdeas(data.ideas || [])
    setLoading(false)
  }

  async function fetchLastRun() {
    const res = await fetch('/api/intelligence/last-run')
    if (res.ok) {
      const data = await res.json()
      setLastRun(data.run)
    }
  }

  async function handleGenerate() {
    setGenerating(true)
    setGenerateResult(null)
    const res = await fetch('/api/intelligence/generate', { method: 'POST' })
    const data = await res.json()
    setGenerating(false)
    if (res.ok) {
      setGenerateResult(`✓ ${data.message}`)
      fetchIdeas()
      fetchLastRun()
    } else {
      setGenerateResult(`Error: ${data.error}`)
    }
  }

  async function handleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null)
      return
    }
    setExpandedId(id)
    if (!briefs[id]) {
      setBriefLoading(id)
      const res = await fetch(`/api/intelligence/brief/${id}`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) setBriefs((prev) => ({ ...prev, [id]: data.brief }))
      setBriefLoading(null)
      fetchIdeas()
    }
  }

  async function handleSendToChat(ideaId: string) {
    const res = await fetch('/api/intelligence/send-to-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idea_id: ideaId }),
    })
    const data = await res.json()
    if (res.ok) {
      const encoded = encodeURIComponent(data.chat_prompt)
      router.push(`/chat?idea_prompt=${encoded}`)
    }
  }

  async function handleStatusChange(id: string, status: ContentIdea['status']) {
    await fetch('/api/content-ideas', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    setIdeas((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)))
  }

  const filtered = ideas.filter((idea) => {
    if (filterStatus !== 'todas' && idea.status !== filterStatus) return false
    if (filterTopic !== 'todos' && idea.topic_tag !== filterTopic) return false
    if (filterPerf !== 'todos' && idea.estimated_performance !== filterPerf) return false
    return true
  })

  const topics = Array.from(new Set(ideas.map((i) => i.topic_tag).filter(Boolean))) as string[]

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      {/* Sidebar filtros */}
      <div className="w-56 border-r border-zinc-200 flex flex-col shrink-0">
        <div className="px-4 pt-5 pb-3 border-b border-zinc-100">
          <h1 className="text-base font-semibold text-zinc-900">Banco de Ideas</h1>
          <p className="text-xs text-zinc-400 mt-0.5">{ideas.length} ideas totales</p>
        </div>

        {/* Last run banner */}
        {lastRun && (
          <div className="mx-3 mt-3 text-xs bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5">
            <p className="text-zinc-600 font-medium">Último análisis</p>
            <p className="text-zinc-400 mt-0.5">
              {lastRun.ideas_generated} ideas ·{' '}
              {lastRun.completed_at
                ? new Date(lastRun.completed_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
                : 'pendiente'}
            </p>
          </div>
        )}

        <div className="p-3 space-y-3 flex-1 overflow-y-auto">
          {/* Estado */}
          <div>
            <p className="text-xs text-zinc-400 font-medium mb-1.5 px-1">Estado</p>
            {['todas', 'nueva', 'en_proceso', 'usada', 'descartada'].map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`w-full text-left text-xs px-3 py-1.5 rounded-lg transition-colors ${
                  filterStatus === s ? 'bg-zinc-900 text-white font-medium' : 'text-zinc-500 hover:bg-zinc-100'
                }`}
              >
                {s === 'todas' ? 'Todas' : s}
              </button>
            ))}
          </div>

          {/* Tema */}
          <div>
            <p className="text-xs text-zinc-400 font-medium mb-1.5 px-1">Tema</p>
            {['todos', ...topics].map((t) => (
              <button
                key={t}
                onClick={() => setFilterTopic(t)}
                className={`w-full text-left text-xs px-3 py-1.5 rounded-lg transition-colors ${
                  filterTopic === t ? 'bg-zinc-900 text-white font-medium' : 'text-zinc-500 hover:bg-zinc-100'
                }`}
              >
                {t === 'todos' ? 'Todos' : (TOPIC_LABELS[t] || t.replace(/_/g, ' '))}
              </button>
            ))}
          </div>

          {/* Performance */}
          <div>
            <p className="text-xs text-zinc-400 font-medium mb-1.5 px-1">Performance est.</p>
            {['todos', 'viral', 'alto', 'medio', 'bajo'].map((p) => (
              <button
                key={p}
                onClick={() => setFilterPerf(p)}
                className={`w-full text-left text-xs px-3 py-1.5 rounded-lg transition-colors ${
                  filterPerf === p ? 'bg-zinc-900 text-white font-medium' : 'text-zinc-500 hover:bg-zinc-100'
                }`}
              >
                {p === 'todos' ? 'Todos' : p}
              </button>
            ))}
          </div>
        </div>

        {/* Generar nuevas ideas */}
        <div className="p-3 border-t border-zinc-100">
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="w-full text-xs bg-zinc-900 hover:bg-zinc-700 disabled:bg-zinc-200 text-white disabled:text-zinc-400 rounded-xl py-3 font-medium transition-colors"
          >
            {generating ? '✦ Generando...' : '✦ Generar nuevas ideas'}
          </button>
          {generateResult && (
            <p className={`text-xs mt-2 text-center ${generateResult.startsWith('✓') ? 'text-green-600' : 'text-red-600'}`}>
              {generateResult}
            </p>
          )}
        </div>
      </div>

      {/* Grid de ideas */}
      <div className="flex-1 overflow-y-auto p-5">
        {loading && (
          <div className="flex items-center justify-center h-full">
            <div className="w-6 h-6 border-2 border-zinc-200 border-t-zinc-600 rounded-full animate-spin" />
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-zinc-50 border border-zinc-200 flex items-center justify-center text-2xl text-zinc-400">
              ◎
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-700">
                {ideas.length === 0 ? 'Sin ideas todavía' : 'Sin resultados con esos filtros'}
              </p>
              <p className="text-xs text-zinc-400 mt-1 max-w-xs">
                {ideas.length === 0
                  ? 'Hacé click en "Generar nuevas ideas" para que Claude analice tu cuenta y la competencia.'
                  : 'Probá cambiando los filtros.'}
              </p>
            </div>
            {ideas.length === 0 && (
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="text-sm bg-zinc-900 text-white rounded-xl px-5 py-2.5 hover:bg-zinc-700 disabled:opacity-50 transition-colors"
              >
                {generating ? '✦ Generando...' : '✦ Generar ideas ahora'}
              </button>
            )}
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 max-w-5xl">
            {filtered.map((idea) => (
              <IdeaCard
                key={idea.id}
                idea={idea}
                onExpand={handleExpand}
                onSendToChat={handleSendToChat}
                onStatusChange={handleStatusChange}
                expanded={expandedId === idea.id}
                brief={briefs[idea.id]}
                briefLoading={briefLoading === idea.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
