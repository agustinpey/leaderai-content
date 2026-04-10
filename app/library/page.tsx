'use client'

import { useState, useEffect, useRef } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Post, PostFormat, PostStatus } from '@/lib/types'

const STATUS_BADGE: Record<PostStatus, string> = {
  borrador: 'bg-zinc-800 text-zinc-400 border-zinc-700',
  listo: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  programado: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  publicado: 'bg-green-500/10 text-green-400 border-green-500/30',
}

const FORMAT_ICON: Record<PostFormat, string> = {
  reel: '▶',
  carrusel: '⊟',
  historia: '○',
  foto: '□',
}

type FilterStatus = PostStatus | 'todos'

export default function LibraryPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('todos')
  const [filterFormat, setFilterFormat] = useState<PostFormat | 'todos'>('todos')
  const [selected, setSelected] = useState<Post | null>(null)
  const [showNewPost, setShowNewPost] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    title: '',
    format: 'reel' as PostFormat,
    status: 'borrador' as PostStatus,
    script: '',
    caption: '',
    hooks: ['', '', ''],
    tags: '',
  })

  async function fetchPosts() {
    setLoading(true)
    let url = '/api/posts'
    if (filterStatus !== 'todos') url += `?status=${filterStatus}`
    const res = await fetch(url)
    const data = await res.json()
    setPosts(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { fetchPosts() }, [filterStatus])

  const filtered = posts.filter((p) => {
    if (filterFormat !== 'todos' && p.format !== filterFormat) return false
    return true
  })

  async function handleSave() {
    setSaving(true)
    const hooks = form.hooks.filter(Boolean)
    const tags = form.tags.split(',').map((t) => t.trim()).filter(Boolean)

    await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, hooks, tags }),
    })

    setSaving(false)
    setShowNewPost(false)
    setForm({ title: '', format: 'reel', status: 'borrador', script: '', caption: '', hooks: ['', '', ''], tags: '' })
    fetchPosts()
  }

  async function handleStatusChange(id: string, status: PostStatus) {
    await fetch('/api/posts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    fetchPosts()
    if (selected?.id === id) setSelected({ ...selected, status })
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este post?')) return
    await fetch(`/api/posts?id=${id}`, { method: 'DELETE' })
    setSelected(null)
    fetchPosts()
  }

  return (
    <div className="flex h-screen">
      {/* Lista */}
      <div className="flex-1 flex flex-col p-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-lg font-semibold text-zinc-100">Biblioteca</h1>
          <button
            onClick={() => setShowNewPost(true)}
            className="text-sm bg-zinc-100 hover:bg-white text-zinc-900 rounded-lg px-4 py-2 font-medium transition-colors"
          >
            + Nuevo
          </button>
        </div>

        {/* Filtros */}
        <div className="flex gap-2 mb-5 flex-wrap">
          {(['todos', 'borrador', 'listo', 'programado', 'publicado'] as FilterStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors capitalize ${
                filterStatus === s
                  ? 'bg-zinc-100 text-zinc-900 border-zinc-100'
                  : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-zinc-200'
              }`}
            >
              {s}
            </button>
          ))}
          <div className="w-px bg-zinc-800 mx-1" />
          {(['todos', 'reel', 'carrusel', 'historia', 'foto'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilterFormat(f)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors capitalize ${
                filterFormat === f
                  ? 'bg-zinc-700 text-zinc-100 border-zinc-600'
                  : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:border-zinc-700 hover:text-zinc-300'
              }`}
            >
              {f !== 'todos' && <span className="mr-1">{FORMAT_ICON[f as PostFormat]}</span>}
              {f}
            </button>
          ))}
        </div>

        {/* Grid de posts */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-xs text-zinc-600">Cargando...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <p className="text-sm text-zinc-600">No hay posts con estos filtros</p>
            <button
              onClick={() => setShowNewPost(true)}
              className="text-xs text-zinc-400 border border-zinc-800 hover:border-zinc-700 rounded-lg px-4 py-2"
            >
              + Crear el primero
            </button>
          </div>
        ) : (
          <div className="overflow-y-auto flex-1 grid grid-cols-1 gap-2 content-start">
            {filtered.map((post) => (
              <div
                key={post.id}
                onClick={() => setSelected(post)}
                className={`flex items-center gap-4 bg-zinc-900 border rounded-xl px-4 py-3.5 cursor-pointer transition-colors ${
                  selected?.id === post.id
                    ? 'border-zinc-600'
                    : 'border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-sm shrink-0">
                  {FORMAT_ICON[post.format]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-200 font-medium truncate">{post.title}</p>
                  <p className="text-xs text-zinc-600 mt-0.5">
                    {format(new Date(post.created_at), "d MMM yyyy", { locale: es })}
                    {post.tags && post.tags.length > 0 && (
                      <span className="ml-2 text-zinc-700">{post.tags.slice(0, 2).join(' · ')}</span>
                    )}
                  </p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_BADGE[post.status]}`}>
                  {post.status}
                </span>
                {(post as any).metrics && (
                  <div className="text-right text-xs text-zinc-500 shrink-0">
                    <div>{(post as any).metrics.saves} saves</div>
                    <div>{(post as any).metrics.reach} reach</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Panel de detalle */}
      {selected && (
        <div className="w-80 border-l border-zinc-800 p-5 overflow-y-auto flex flex-col gap-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-semibold text-zinc-100">{selected.title}</p>
              <p className="text-xs text-zinc-500 mt-0.5 capitalize">{selected.format}</p>
            </div>
            <button onClick={() => setSelected(null)} className="text-zinc-600 hover:text-zinc-400 text-sm">✕</button>
          </div>

          {/* Estado */}
          <div>
            <label className="text-xs text-zinc-500 mb-1.5 block">Estado</label>
            <select
              value={selected.status}
              onChange={(e) => handleStatusChange(selected.id, e.target.value as PostStatus)}
              className="w-full text-sm bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-300 outline-none"
            >
              <option value="borrador">Borrador</option>
              <option value="listo">Listo</option>
              <option value="programado">Programado</option>
              <option value="publicado">Publicado</option>
            </select>
          </div>

          {/* Hooks */}
          {selected.hooks && selected.hooks.length > 0 && (
            <div>
              <label className="text-xs text-zinc-500 mb-1.5 block">Hooks</label>
              <div className="space-y-1.5">
                {selected.hooks.map((hook, i) => (
                  <div key={i} className="text-xs bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-300">
                    "{hook}"
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Script */}
          {selected.script && (
            <div>
              <label className="text-xs text-zinc-500 mb-1.5 block">Guión</label>
              <div className="text-xs bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-3 text-zinc-300 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                {selected.script}
              </div>
            </div>
          )}

          {/* Caption */}
          {selected.caption && (
            <div>
              <label className="text-xs text-zinc-500 mb-1.5 block">Caption</label>
              <div className="text-xs bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-3 text-zinc-300 whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
                {selected.caption}
              </div>
            </div>
          )}

          {/* Métricas */}
          {(selected as any).metrics && (
            <div>
              <label className="text-xs text-zinc-500 mb-1.5 block">Métricas</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Reach', value: (selected as any).metrics.reach },
                  { label: 'Likes', value: (selected as any).metrics.likes },
                  { label: 'Saves', value: (selected as any).metrics.saves },
                  { label: 'Plays', value: (selected as any).metrics.plays },
                ].map((m) => (
                  <div key={m.label} className="bg-zinc-800 rounded-lg p-2.5 text-center">
                    <p className="text-sm font-semibold text-zinc-100">{m.value?.toLocaleString() || 0}</p>
                    <p className="text-xs text-zinc-500">{m.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {selected.tags && selected.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selected.tags.map((tag) => (
                <span key={tag} className="text-xs bg-zinc-800 border border-zinc-700 text-zinc-400 rounded-full px-2 py-0.5">
                  {tag}
                </span>
              ))}
            </div>
          )}

          <button
            onClick={() => handleDelete(selected.id)}
            className="mt-auto text-xs text-red-500 hover:text-red-400 border border-red-500/20 hover:border-red-500/40 rounded-lg py-2 transition-colors"
          >
            Eliminar post
          </button>
        </div>
      )}

      {/* Modal nuevo post */}
      {showNewPost && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-lg my-auto">
            <h2 className="text-base font-semibold text-zinc-100 mb-5">Nuevo post</h2>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-zinc-500 mb-1.5 block">Título *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Ej: 3 errores que cometen los closers"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-500 mb-1.5 block">Formato</label>
                  <select value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value as PostFormat })} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-zinc-300 outline-none">
                    <option value="reel">Reel</option>
                    <option value="carrusel">Carrusel</option>
                    <option value="historia">Historia</option>
                    <option value="foto">Foto</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-zinc-500 mb-1.5 block">Estado</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as PostStatus })} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-zinc-300 outline-none">
                    <option value="borrador">Borrador</option>
                    <option value="listo">Listo</option>
                    <option value="programado">Programado</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-zinc-500 mb-1.5 block">Hooks (3 opciones)</label>
                <div className="space-y-2">
                  {form.hooks.map((hook, i) => (
                    <input
                      key={i}
                      type="text"
                      value={hook}
                      onChange={(e) => {
                        const hooks = [...form.hooks]
                        hooks[i] = e.target.value
                        setForm({ ...form, hooks })
                      }}
                      placeholder={`Hook ${i + 1}`}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-300 placeholder-zinc-600 outline-none focus:border-zinc-500"
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-zinc-500 mb-1.5 block">Guión</label>
                <textarea
                  value={form.script}
                  onChange={(e) => setForm({ ...form, script: e.target.value })}
                  rows={5}
                  placeholder="Pegá el guión generado por Claude..."
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-zinc-300 placeholder-zinc-600 outline-none resize-none focus:border-zinc-500"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-500 mb-1.5 block">Caption</label>
                <textarea
                  value={form.caption}
                  onChange={(e) => setForm({ ...form, caption: e.target.value })}
                  rows={3}
                  placeholder="Caption del post..."
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-zinc-300 placeholder-zinc-600 outline-none resize-none focus:border-zinc-500"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-500 mb-1.5 block">Tags (separados por coma)</label>
                <input
                  type="text"
                  value={form.tags}
                  onChange={(e) => setForm({ ...form, tags: e.target.value })}
                  placeholder="ventas, automatización, leadgen"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-zinc-300 placeholder-zinc-600 outline-none focus:border-zinc-500"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowNewPost(false)} className="flex-1 text-sm border border-zinc-700 text-zinc-400 rounded-xl py-2.5 hover:border-zinc-600 transition-colors">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={!form.title || saving} className="flex-1 text-sm bg-zinc-100 hover:bg-white disabled:bg-zinc-700 text-zinc-900 disabled:text-zinc-500 rounded-xl py-2.5 font-medium transition-colors">
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
