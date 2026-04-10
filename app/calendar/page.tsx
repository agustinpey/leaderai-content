'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  isToday,
  parseISO,
} from 'date-fns'
import { es } from 'date-fns/locale'
import { Post, PostFormat, PostStatus } from '@/lib/types'

const FORMAT_COLORS: Record<PostFormat, string> = {
  reel: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  carrusel: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  historia: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  foto: 'bg-green-500/20 text-green-300 border-green-500/30',
}

const STATUS_DOT: Record<PostStatus, string> = {
  borrador: 'bg-zinc-500',
  listo: 'bg-yellow-400',
  programado: 'bg-blue-400',
  publicado: 'bg-green-400',
}

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [posts, setPosts] = useState<Post[]>([])
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({
    title: '',
    format: 'reel' as PostFormat,
    scheduled_at: '',
    status: 'programado' as PostStatus,
    script: '',
    caption: '',
  })
  const [gcalConnected, setGcalConnected] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)

  const monthKey = format(currentMonth, 'yyyy-MM')

  const fetchPosts = useCallback(async () => {
    setLoading(true)
    const [postsRes, gcalRes] = await Promise.all([
      fetch(`/api/posts?month=${monthKey}`),
      fetch('/api/integrations/status?provider=google_calendar'),
    ])
    const data = await postsRes.json()
    const gcal = gcalRes.ok ? await gcalRes.json() : { connected: false }
    setPosts(Array.isArray(data) ? data : [])
    setGcalConnected(gcal.connected)
    setLoading(false)
  }, [monthKey])

  useEffect(() => {
    fetchPosts()
  }, [fetchPosts])

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  })

  const startDayOfWeek = startOfMonth(currentMonth).getDay()
  const paddingDays = Array(startDayOfWeek === 0 ? 6 : startDayOfWeek - 1).fill(null)

  function getPostsForDay(day: Date) {
    return posts.filter((p) => {
      const date = p.scheduled_at || p.published_at
      return date && isSameDay(parseISO(date), day)
    })
  }

  async function handleSavePost() {
    if (!form.title || !form.scheduled_at) return

    await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    setShowModal(false)
    setForm({ title: '', format: 'reel', scheduled_at: '', status: 'programado', script: '', caption: '' })
    fetchPosts()
  }

  async function handleStatusChange(postId: string, newStatus: PostStatus) {
    await fetch('/api/posts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: postId, status: newStatus }),
    })
    fetchPosts()
  }

  function openNewPost(day: Date) {
    setSelectedDay(day)
    setForm((f) => ({
      ...f,
      scheduled_at: format(day, "yyyy-MM-dd'T'09:00"),
    }))
    setShowModal(true)
  }

  const selectedDayPosts = selectedDay ? getPostsForDay(selectedDay) : []

  return (
    <div className="flex h-screen">
      {/* Calendario */}
      <div className="flex-1 flex flex-col p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold text-zinc-100">
              {format(currentMonth, 'MMMM yyyy', { locale: es })}
            </h1>
            <div className="flex gap-1">
              <button
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors"
              >
                ←
              </button>
              <button
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors"
              >
                →
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            {gcalConnected ? (
              <button
                onClick={async () => {
                  setSyncing(true)
                  setSyncMsg(null)
                  const res = await fetch('/api/google-calendar/sync', { method: 'POST' })
                  const data = await res.json()
                  setSyncMsg(res.ok ? `✓ ${data.message}` : `Error: ${data.error}`)
                  setSyncing(false)
                }}
                disabled={syncing}
                className="text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg px-3 py-2 transition-colors"
              >
                {syncing ? '↻...' : '↻ Google Cal'}
              </button>
            ) : (
              <a
                href="/settings"
                className="text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-400 border border-zinc-700 rounded-lg px-3 py-2 transition-colors"
                title="Conectar Google Calendar"
              >
                + Google Cal
              </a>
            )}
            <button
              onClick={() => {
                setSelectedDay(new Date())
                setShowModal(true)
              }}
              className="text-sm bg-zinc-100 hover:bg-white text-zinc-900 rounded-lg px-4 py-2 font-medium transition-colors"
            >
              + Nuevo post
            </button>
          </div>
        </div>

        {/* Sync message */}
        {syncMsg && (
          <div className={`mb-3 text-xs px-3 py-2 rounded-lg border flex items-center justify-between ${syncMsg.startsWith('✓') ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
            {syncMsg}
            <button onClick={() => setSyncMsg(null)} className="opacity-50 hover:opacity-100 ml-3">✕</button>
          </div>
        )}

        {/* Días de semana */}
        <div className="grid grid-cols-7 mb-2">
          {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => (
            <div key={d} className="text-center text-xs text-zinc-600 py-2 font-medium">
              {d}
            </div>
          ))}
        </div>

        {/* Grid de días */}
        <div className="grid grid-cols-7 gap-1 flex-1">
          {paddingDays.map((_, i) => (
            <div key={`pad-${i}`} />
          ))}
          {days.map((day) => {
            const dayPosts = getPostsForDay(day)
            const isSelected = selectedDay && isSameDay(day, selectedDay)
            const isCurrentDay = isToday(day)

            return (
              <div
                key={day.toISOString()}
                onClick={() => setSelectedDay(day)}
                className={`border rounded-xl p-2 cursor-pointer transition-colors min-h-[80px] ${
                  isSelected
                    ? 'border-zinc-600 bg-zinc-800'
                    : isCurrentDay
                    ? 'border-zinc-600 bg-zinc-900/60'
                    : 'border-zinc-800/60 bg-zinc-900/20 hover:bg-zinc-900/60 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className={`text-xs font-medium ${
                      isCurrentDay
                        ? 'bg-white text-zinc-900 rounded-full w-5 h-5 flex items-center justify-center'
                        : isSameMonth(day, currentMonth)
                        ? 'text-zinc-300'
                        : 'text-zinc-700'
                    }`}
                  >
                    {format(day, 'd')}
                  </span>
                  {dayPosts.length > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        openNewPost(day)
                      }}
                      className="text-zinc-600 hover:text-zinc-400 text-xs"
                    >
                      +
                    </button>
                  )}
                </div>
                <div className="space-y-0.5">
                  {dayPosts.slice(0, 2).map((post) => (
                    <div
                      key={post.id}
                      className={`text-xs px-1.5 py-0.5 rounded border truncate ${
                        FORMAT_COLORS[post.format]
                      }`}
                    >
                      <span
                        className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${STATUS_DOT[post.status]}`}
                      />
                      {post.title}
                    </div>
                  ))}
                  {dayPosts.length > 2 && (
                    <div className="text-xs text-zinc-600 px-1">+{dayPosts.length - 2} más</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Panel lateral — día seleccionado */}
      <div className="w-72 border-l border-zinc-800 p-5 flex flex-col gap-4">
        {selectedDay ? (
          <>
            <div>
              <p className="text-sm font-medium text-zinc-100">
                {format(selectedDay, "d 'de' MMMM", { locale: es })}
              </p>
              <p className="text-xs text-zinc-500 mt-0.5">{selectedDayPosts.length} posts</p>
            </div>

            {selectedDayPosts.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-xs text-zinc-600">Día libre</p>
                <button
                  onClick={() => openNewPost(selectedDay)}
                  className="mt-3 text-xs text-zinc-400 hover:text-zinc-200 border border-zinc-800 hover:border-zinc-700 rounded-lg px-3 py-2 transition-colors"
                >
                  + Agregar post
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedDayPosts.map((post) => (
                  <div key={post.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="text-sm text-zinc-200 font-medium">{post.title}</p>
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded border ${FORMAT_COLORS[post.format]}`}
                      >
                        {post.format}
                      </span>
                    </div>
                    {post.scheduled_at && (
                      <p className="text-xs text-zinc-500 mb-2">
                        {format(parseISO(post.scheduled_at), 'HH:mm')}
                      </p>
                    )}
                    <select
                      value={post.status}
                      onChange={(e) => handleStatusChange(post.id, e.target.value as PostStatus)}
                      className="w-full text-xs bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-zinc-300 outline-none"
                    >
                      <option value="borrador">Borrador</option>
                      <option value="listo">Listo</option>
                      <option value="programado">Programado</option>
                      <option value="publicado">Publicado</option>
                    </select>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <p className="text-xs text-zinc-600 text-center">
              Seleccioná un día para ver o agregar posts
            </p>
          </div>
        )}

        {/* Leyenda */}
        <div className="mt-auto pt-4 border-t border-zinc-800 space-y-1.5">
          {Object.entries(FORMAT_COLORS).map(([fmt, cls]) => (
            <div key={fmt} className="flex items-center gap-2">
              <span className={`text-xs px-1.5 py-0.5 rounded border ${cls}`}>{fmt}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Modal nuevo post */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-base font-semibold text-zinc-100 mb-5">Nuevo post</h2>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-zinc-500 mb-1.5 block">Título</label>
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
                  <select
                    value={form.format}
                    onChange={(e) => setForm({ ...form, format: e.target.value as PostFormat })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-zinc-300 outline-none"
                  >
                    <option value="reel">Reel</option>
                    <option value="carrusel">Carrusel</option>
                    <option value="historia">Historia</option>
                    <option value="foto">Foto</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-zinc-500 mb-1.5 block">Estado</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as PostStatus })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-zinc-300 outline-none"
                  >
                    <option value="borrador">Borrador</option>
                    <option value="listo">Listo</option>
                    <option value="programado">Programado</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-zinc-500 mb-1.5 block">Fecha y hora de publicación</label>
                <input
                  type="datetime-local"
                  value={form.scheduled_at}
                  onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-zinc-300 outline-none focus:border-zinc-500"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-500 mb-1.5 block">Caption (opcional)</label>
                <textarea
                  value={form.caption}
                  onChange={(e) => setForm({ ...form, caption: e.target.value })}
                  rows={3}
                  placeholder="Caption del post..."
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-zinc-300 placeholder-zinc-600 outline-none resize-none focus:border-zinc-500"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 text-sm border border-zinc-700 hover:border-zinc-600 text-zinc-400 rounded-xl py-2.5 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSavePost}
                disabled={!form.title}
                className="flex-1 text-sm bg-zinc-100 hover:bg-white disabled:bg-zinc-700 text-zinc-900 disabled:text-zinc-500 rounded-xl py-2.5 font-medium transition-colors"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
