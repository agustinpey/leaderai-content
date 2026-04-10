import { getIntegration, upsertIntegration } from '@/lib/integrations'
import { NextRequest } from 'next/server'

// GET — obtener calendarios disponibles y cuáles están seleccionados
export async function GET() {
  try {
    const integration = await getIntegration('google_calendar')

    if (!integration?.access_token) {
      return Response.json({ connected: false, calendars: [], selected: [] })
    }

    return Response.json({
      connected: true,
      calendars: integration.metadata?.calendars || [],
      selected: integration.metadata?.selected_calendar_ids || [],
    })
  } catch {
    return Response.json({ connected: false, calendars: [], selected: [] })
  }
}

// PATCH — actualizar qué calendarios están seleccionados
export async function PATCH(req: NextRequest) {
  const { selected_calendar_ids } = await req.json()

  const integration = await getIntegration('google_calendar')
  if (!integration) return Response.json({ error: 'No conectado' }, { status: 401 })

  await upsertIntegration('google_calendar', {}, { selected_calendar_ids })

  return Response.json({ ok: true, selected: selected_calendar_ids })
}
