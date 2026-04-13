'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

interface CalendarInfo {
  id: string
  summary: string
  primary: boolean
  backgroundColor: string
}

interface IntegrationStatus {
  connected: boolean
  metadata: any
  expires_at: string | null
}

function SettingsContent() {
  const searchParams = useSearchParams()
  const [igStatus, setIgStatus] = useState<IntegrationStatus | null>(null)
  const [gcalStatus, setGcalStatus] = useState<IntegrationStatus | null>(null)
  const [calendars, setCalendars] = useState<CalendarInfo[]>([])
  const [selectedCalendars, setSelectedCalendars] = useState<string[]>([])
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const successParam = searchParams.get('success')
  const errorParam = searchParams.get('error')
  const errorMsg = searchParams.get('msg')

  async function fetchStatus() {
    setLoading(true)
    try {
      const [igRes, gcalRes, calRes] = await Promise.all([
        fetch('/api/integrations/status?provider=instagram'),
        fetch('/api/integrations/status?provider=google_calendar'),
        fetch('/api/google-calendar/calendars'),
      ])

      const ig = igRes.ok ? await igRes.json() : { connected: false, metadata: {} }
      const gcal = gcalRes.ok ? await gcalRes.json() : { connected: false, metadata: {} }
      const calData = calRes.ok ? await calRes.json() : { calendars: [], selected: [] }

      setIgStatus(ig)
      setGcalStatus(gcal)
      setCalendars(calData.calendars || [])
      setSelectedCalendars(calData.selected || [])
    } catch {}
    setLoading(false)
  }

  useEffect(() => { fetchStatus() }, [])

  async function handleDisconnect(provider: string) {
    if (!confirm(`¿Desconectar ${provider === 'instagram' ? 'Instagram' : 'Google Calendar'}?`)) return
    await fetch('/api/integrations/disconnect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider }),
    })
    fetchStatus()
  }

  async function handleCalendarToggle(calId: string) {
    const updated = selectedCalendars.includes(calId)
      ? selectedCalendars.filter((id) => id !== calId)
      : [...selectedCalendars, calId]

    setSelectedCalendars(updated)
    await fetch('/api/google-calendar/calendars', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selected_calendar_ids: updated }),
    })
  }

  async function handleGcalSync() {
    setSyncing(true)
    setSyncResult(null)
    const res = await fetch('/api/google-calendar/sync', { method: 'POST' })
    const data = await res.json()
    setSyncResult(res.ok ? `✓ ${data.message}` : `Error: ${data.error}`)
    setSyncing(false)
  }

  async function handleIgSync() {
    setSyncing(true)
    setSyncResult(null)
    const res = await fetch('/api/instagram/sync', { method: 'POST' })
    const data = await res.json()
    setSyncResult(res.ok ? `✓ ${data.message}` : `Error: ${data.error}`)
    setSyncing(false)
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-lg font-semibold text-zinc-100">Integraciones</h1>
        <p className="text-xs text-zinc-500 mt-1">Conectá tus cuentas para automatizar el flujo de contenido</p>
      </div>

      {/* Banners de éxito/error */}
      {successParam === 'instagram' && (
        <div className="mb-5 text-xs px-4 py-3 bg-green-500/10 border border-green-500/30 text-green-400 rounded-lg">
          ✓ Instagram conectado correctamente
        </div>
      )}
      {successParam === 'google_calendar' && (
        <div className="mb-5 text-xs px-4 py-3 bg-green-500/10 border border-green-500/30 text-green-400 rounded-lg">
          ✓ Google Calendar conectado correctamente
        </div>
      )}
      {errorParam && (
        <div className="mb-5 text-xs px-4 py-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg">
          Error al conectar. {errorMsg ? <span className="font-mono">{decodeURIComponent(errorMsg)}</span> : 'Verificá que diste los permisos necesarios.'}
        </div>
      )}
      {syncResult && (
        <div className={`mb-5 text-xs px-4 py-3 rounded-lg border ${syncResult.startsWith('✓') ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
          {syncResult}
          <button onClick={() => setSyncResult(null)} className="ml-3 opacity-50 hover:opacity-100">✕</button>
        </div>
      )}

      {loading ? (
        <p className="text-xs text-zinc-600">Cargando...</p>
      ) : (
        <div className="space-y-5">
          {/* Instagram */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-white text-sm font-bold">
                  IG
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-100">Instagram</p>
                  <p className="text-xs text-zinc-500">
                    {igStatus?.connected
                      ? `Conectado como @${igStatus.metadata?.ig_username || 'usuario'}`
                      : 'No conectado'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {igStatus?.connected && (
                  <>
                    <span className="text-xs bg-green-500/10 border border-green-500/30 text-green-400 rounded-full px-2 py-0.5">
                      Activo
                    </span>
                    <button
                      onClick={handleIgSync}
                      disabled={syncing}
                      className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 rounded-lg px-3 py-1.5 transition-colors"
                    >
                      {syncing ? '↻...' : '↻ Sync'}
                    </button>
                    <button
                      onClick={() => handleDisconnect('instagram')}
                      className="text-xs text-red-500 hover:text-red-400 border border-red-500/20 hover:border-red-500/40 rounded-lg px-2 py-1.5 transition-colors"
                    >
                      Desconectar
                    </button>
                  </>
                )}
                {!igStatus?.connected && (
                  <a
                    href="/api/instagram/auth"
                    className="text-xs bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-lg px-4 py-2 font-medium transition-all"
                  >
                    Conectar
                  </a>
                )}
              </div>
            </div>

            <div className="text-xs text-zinc-600 bg-zinc-800/50 rounded-xl p-3 leading-relaxed">
              {igStatus?.connected ? (
                <>
                  Hacé click en <strong className="text-zinc-400">Sync</strong> para importar tus últimos 25 posts con métricas desde Instagram. También se puede hacer desde la página de Analytics.
                </>
              ) : (
                <>
                  Al conectar, la app podrá leer tus posts publicados y las métricas (reach, saves, plays, likes) directamente de Instagram. Requiere una app en{' '}
                  <a href="https://developers.facebook.com" target="_blank" rel="noopener" className="text-blue-400 hover:underline">
                    developers.facebook.com
                  </a>{' '}
                  con las variables <code className="text-purple-400">INSTAGRAM_APP_ID</code> y <code className="text-purple-400">INSTAGRAM_APP_SECRET</code> en el .env.local.
                </>
              )}
            </div>
          </div>

          {/* Google Calendar */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white text-sm font-bold">
                  GC
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-100">Google Calendar</p>
                  <p className="text-xs text-zinc-500">
                    {gcalStatus?.connected
                      ? `${calendars.length} calendarios disponibles · ${selectedCalendars.length} seleccionado${selectedCalendars.length !== 1 ? 's' : ''}`
                      : 'No conectado'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {gcalStatus?.connected && (
                  <>
                    <span className="text-xs bg-green-500/10 border border-green-500/30 text-green-400 rounded-full px-2 py-0.5">
                      Activo
                    </span>
                    <button
                      onClick={handleGcalSync}
                      disabled={syncing}
                      className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 rounded-lg px-3 py-1.5 transition-colors"
                    >
                      {syncing ? '↻...' : '↻ Sync posts'}
                    </button>
                    <button
                      onClick={() => handleDisconnect('google_calendar')}
                      className="text-xs text-red-500 hover:text-red-400 border border-red-500/20 hover:border-red-500/40 rounded-lg px-2 py-1.5 transition-colors"
                    >
                      Desconectar
                    </button>
                  </>
                )}
                {!gcalStatus?.connected && (
                  <a
                    href="/api/google-calendar/auth"
                    className="text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-4 py-2 font-medium transition-colors"
                  >
                    Conectar
                  </a>
                )}
              </div>
            </div>

            {/* Selector de calendarios */}
            {gcalStatus?.connected && calendars.length > 0 && (
              <div className="mb-4">
                <p className="text-xs text-zinc-500 mb-2 font-medium">Calendarios para sincronizar posts</p>
                <div className="space-y-2">
                  {calendars.map((cal) => (
                    <label key={cal.id} className="flex items-center gap-3 cursor-pointer group">
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={selectedCalendars.includes(cal.id || '')}
                          onChange={() => handleCalendarToggle(cal.id || '')}
                          className="sr-only"
                        />
                        <div
                          className={`w-4 h-4 rounded border transition-colors ${
                            selectedCalendars.includes(cal.id || '')
                              ? 'bg-blue-600 border-blue-600'
                              : 'border-zinc-600 group-hover:border-zinc-400'
                          } flex items-center justify-center`}
                        >
                          {selectedCalendars.includes(cal.id || '') && (
                            <span className="text-white text-xs leading-none">✓</span>
                          )}
                        </div>
                      </div>
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: cal.backgroundColor || '#4285f4' }}
                      />
                      <span className="text-sm text-zinc-200">{cal.summary}</span>
                      {cal.primary && (
                        <span className="text-xs text-zinc-600 ml-1">(principal)</span>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="text-xs text-zinc-600 bg-zinc-800/50 rounded-xl p-3 leading-relaxed">
              {gcalStatus?.connected ? (
                <>
                  Los posts con fecha programada se crean como eventos en los calendarios seleccionados. Hacé click en <strong className="text-zinc-400">Sync posts</strong> para sincronizar los que ya tenés programados. También podés hacerlo desde el Calendario.
                </>
              ) : (
                <>
                  Al conectar, los posts programados se agregan como eventos a tu Google Calendar. Podés elegir a qué calendarios sincronizar. Requiere{' '}
                  <code className="text-blue-400">GOOGLE_CLIENT_ID</code> y{' '}
                  <code className="text-blue-400">GOOGLE_CLIENT_SECRET</code> en el .env.local desde{' '}
                  <a href="https://console.cloud.google.com" target="_blank" rel="noopener" className="text-blue-400 hover:underline">
                    console.cloud.google.com
                  </a>.
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-xs text-zinc-600">Cargando...</div>}>
      <SettingsContent />
    </Suspense>
  )
}
