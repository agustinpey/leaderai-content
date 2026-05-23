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
  const [zernioKey, setZernioKey] = useState('')
  const [zernioConnecting, setZernioConnecting] = useState(false)
  const [zernioResult, setZernioResult] = useState<string | null>(null)

  const successParam = searchParams.get('success')
  const errorParam = searchParams.get('error')
  const errorMsg = searchParams.get('msg')

  const isOAuthError = syncResult?.toLowerCase().includes('invalid oauth') ||
    syncResult?.toLowerCase().includes('oauth access token') ||
    syncResult?.toLowerCase().includes('token')

  async function fetchStatus() {
    setLoading(true)
    try {
      const [igRes, gcalRes, calRes] = await Promise.all([
        fetch('/api/integrations/status?provider=zernio'),
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
    const res = await fetch('/api/zernio/sync', { method: 'POST' })
    const data = await res.json()
    setSyncResult(res.ok ? `✓ ${data.message}` : `Error: ${data.error}`)
    setSyncing(false)
  }

  async function handleZernioConnect() {
    if (!zernioKey.startsWith('sk_')) {
      setZernioResult('Error: la API key debe empezar con sk_')
      return
    }
    setZernioConnecting(true)
    setZernioResult(null)
    const res = await fetch('/api/zernio/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: zernioKey }),
    })
    const data = await res.json()
    if (res.ok) {
      setZernioResult(`✓ ${data.message}`)
      setZernioKey('')
      fetchStatus()
    } else {
      setZernioResult(`Error: ${data.error}`)
    }
    setZernioConnecting(false)
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-lg font-semibold text-zinc-900">Integraciones</h1>
        <p className="text-xs text-zinc-400 mt-1">Conectá tus cuentas para automatizar el flujo de contenido</p>
      </div>

      {/* Banners de éxito/error por URL params */}
      {successParam === 'instagram' && (
        <div className="mb-5 text-xs px-4 py-3 bg-green-50 border border-green-200 text-green-700 rounded-lg">
          ✓ Instagram conectado correctamente
        </div>
      )}
      {successParam === 'google_calendar' && (
        <div className="mb-5 text-xs px-4 py-3 bg-green-50 border border-green-200 text-green-700 rounded-lg">
          ✓ Google Calendar conectado correctamente
        </div>
      )}
      {errorParam && (
        <div className="mb-5 text-xs px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          Error al conectar. {errorMsg ? <span className="font-mono">{decodeURIComponent(errorMsg)}</span> : 'Verificá que diste los permisos necesarios.'}
        </div>
      )}

      {/* Banner de resultado de sync */}
      {syncResult && (
        <div className={`mb-5 text-xs px-4 py-3 rounded-lg border flex items-start justify-between gap-3 ${syncResult.startsWith('✓') ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          <div className="flex-1">
            <p>{syncResult}</p>
            {isOAuthError && (
              <p className="mt-1.5">
                El token de Instagram expiró o es inválido.{' '}
                <a
                  href="/api/instagram/auth"
                  className="underline font-medium hover:opacity-80"
                >
                  Reconectar Instagram →
                </a>
              </p>
            )}
          </div>
          <button onClick={() => setSyncResult(null)} className="opacity-50 hover:opacity-100 shrink-0">✕</button>
        </div>
      )}

      {loading ? (
        <p className="text-xs text-zinc-400">Cargando...</p>
      ) : (
        <div className="space-y-5">
          {/* Instagram via Zernio */}
          <div className="bg-white border border-zinc-200 rounded-2xl p-5">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-white text-sm font-bold">
                  IG
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-900">Instagram via Zernio</p>
                  <p className="text-xs text-zinc-400">
                    {igStatus?.connected
                      ? `Conectado como @${igStatus.metadata?.zernio_username || 'usuario'}`
                      : 'No conectado · ingresá tu API key de Zernio'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {igStatus?.connected && (
                  <>
                    <span className="text-xs bg-green-50 border border-green-200 text-green-700 rounded-full px-2 py-0.5">
                      Activo
                    </span>
                    <button
                      onClick={handleIgSync}
                      disabled={syncing}
                      className="text-xs bg-zinc-100 hover:bg-zinc-200 text-zinc-600 border border-zinc-200 rounded-lg px-3 py-1.5 transition-colors"
                    >
                      {syncing ? '↻...' : '↻ Sync'}
                    </button>
                    <button
                      onClick={() => handleDisconnect('zernio')}
                      className="text-xs text-red-600 hover:text-red-500 border border-red-200 hover:border-red-300 rounded-lg px-2 py-1.5 transition-colors"
                    >
                      Desconectar
                    </button>
                  </>
                )}
              </div>
            </div>

            {!igStatus?.connected && (
              <div className="mb-4 space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={zernioKey}
                    onChange={(e) => setZernioKey(e.target.value)}
                    placeholder="sk_xxxxxxxxxxxxxxxxxxxxxxxx"
                    className="flex-1 border border-zinc-200 rounded-xl px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-zinc-400 font-mono"
                  />
                  <button
                    onClick={handleZernioConnect}
                    disabled={zernioConnecting || !zernioKey}
                    className="text-xs bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 text-white rounded-xl px-4 py-2 font-medium transition-all whitespace-nowrap"
                  >
                    {zernioConnecting ? 'Conectando...' : 'Conectar'}
                  </button>
                </div>
                {zernioResult && (
                  <p className={`text-xs px-3 py-2 rounded-lg border ${zernioResult.startsWith('✓') ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                    {zernioResult}
                  </p>
                )}
              </div>
            )}

            <div className="text-xs text-zinc-400 bg-zinc-50 rounded-xl p-3 leading-relaxed">
              {igStatus?.connected ? (
                <>
                  Hacé click en <strong className="text-zinc-600">Sync</strong> para importar tus posts con métricas reales. Zernio sincroniza automáticamente cada 6-12hs.
                </>
              ) : (
                <>
                  Obtené tu API key en{' '}
                  <a href="https://dash.zernio.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-zinc-600">
                    dash.zernio.com
                  </a>{' '}
                  → Settings → API. Conectá tu Instagram en el dashboard de Zernio primero.
                </>
              )}
            </div>
          </div>

          {/* Google Calendar */}
          <div className="bg-white border border-zinc-200 rounded-2xl p-5">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white text-sm font-bold">
                  GC
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-900">Google Calendar</p>
                  <p className="text-xs text-zinc-400">
                    {gcalStatus?.connected
                      ? `${calendars.length} calendarios disponibles · ${selectedCalendars.length} seleccionado${selectedCalendars.length !== 1 ? 's' : ''}`
                      : 'No conectado'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {gcalStatus?.connected && (
                  <>
                    <span className="text-xs bg-green-50 border border-green-200 text-green-700 rounded-full px-2 py-0.5">
                      Activo
                    </span>
                    <button
                      onClick={handleGcalSync}
                      disabled={syncing}
                      className="text-xs bg-zinc-100 hover:bg-zinc-200 text-zinc-600 border border-zinc-200 rounded-lg px-3 py-1.5 transition-colors"
                    >
                      {syncing ? '↻...' : '↻ Sync posts'}
                    </button>
                    <button
                      onClick={() => handleDisconnect('google_calendar')}
                      className="text-xs text-red-600 hover:text-red-500 border border-red-200 hover:border-red-300 rounded-lg px-2 py-1.5 transition-colors"
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
                              : 'border-zinc-300 group-hover:border-zinc-400'
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
                      <span className="text-sm text-zinc-700">{cal.summary}</span>
                      {cal.primary && (
                        <span className="text-xs text-zinc-400 ml-1">(principal)</span>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="text-xs text-zinc-400 bg-zinc-50 rounded-xl p-3 leading-relaxed">
              {gcalStatus?.connected ? (
                <>
                  Los posts programados se crean como eventos en los calendarios seleccionados. El Calendario también muestra tus reuniones y eventos existentes de Google Calendar.
                </>
              ) : (
                <>
                  Al conectar, los posts programados se agregan como eventos a tu Google Calendar. También vas a poder ver tus reuniones y eventos directamente en el Calendario.
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
    <Suspense fallback={<div className="p-6 text-xs text-zinc-400">Cargando...</div>}>
      <SettingsContent />
    </Suspense>
  )
}
