import { getIntegration } from '@/lib/integrations'
import { supabaseAdmin } from '@/lib/supabase'
import { google } from 'googleapis'
import { NextRequest } from 'next/server'

function getAuthClient(integration: any) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/google-calendar/callback`
  )
  oauth2Client.setCredentials({
    access_token: integration.access_token,
    refresh_token: integration.refresh_token,
  })
  return oauth2Client
}

/**
 * POST /api/google-calendar/sync
 * Sincroniza posts con scheduled_at a los calendarios de Google seleccionados.
 * Crea un evento por cada post que no tenga uno ya.
 */
export async function POST(req: NextRequest) {
  const integration = await getIntegration('google_calendar')

  if (!integration?.access_token) {
    return Response.json({ error: 'Google Calendar no conectado' }, { status: 401 })
  }

  const selectedCalendarIds: string[] = integration.metadata?.selected_calendar_ids || []
  if (selectedCalendarIds.length === 0) {
    return Response.json({ error: 'Ningún calendario seleccionado' }, { status: 400 })
  }

  const auth = getAuthClient(integration)
  const calendar = google.calendar({ version: 'v3', auth })

  // Obtener posts programados con scheduled_at
  const { data: posts } = await supabaseAdmin
    .from('posts')
    .select('*')
    .in('status', ['programado', 'listo'])
    .not('scheduled_at', 'is', null)
    .order('scheduled_at', { ascending: true })
    .limit(50)

  let created = 0
  let errors = 0

  for (const post of posts || []) {
    for (const calendarId of selectedCalendarIds) {
      try {
        const startTime = new Date(post.scheduled_at)
        const endTime = new Date(startTime.getTime() + 60 * 60 * 1000) // +1h

        const event = {
          summary: `📱 Publicar: ${post.title}`,
          description: [
            post.caption ? `Caption:\n${post.caption}` : '',
            post.script ? `\nGuión:\n${post.script.slice(0, 500)}...` : '',
            `\nFormato: ${post.format}`,
            `\nEstado: ${post.status}`,
          ]
            .filter(Boolean)
            .join('\n'),
          start: { dateTime: startTime.toISOString(), timeZone: 'America/Argentina/Buenos_Aires' },
          end: { dateTime: endTime.toISOString(), timeZone: 'America/Argentina/Buenos_Aires' },
          colorId: post.format === 'reel' ? '3' : post.format === 'carrusel' ? '9' : '6',
          extendedProperties: {
            private: {
              leaderai_post_id: post.id,
              post_format: post.format,
            },
          },
        }

        await calendar.events.insert({ calendarId, requestBody: event })
        created++
      } catch {
        errors++
      }
    }
  }

  return Response.json({
    created,
    errors,
    total: (posts || []).length,
    message: `${created} eventos creados en Google Calendar`,
  })
}

/**
 * DELETE /api/google-calendar/sync?post_id=xxx
 * Elimina el evento de Google Calendar asociado a un post.
 */
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const postId = searchParams.get('post_id')
  if (!postId) return Response.json({ error: 'post_id requerido' }, { status: 400 })

  const integration = await getIntegration('google_calendar')
  if (!integration?.access_token) return Response.json({ error: 'No conectado' }, { status: 401 })

  const selectedCalendarIds: string[] = integration.metadata?.selected_calendar_ids || []
  const auth = getAuthClient(integration)
  const calendar = google.calendar({ version: 'v3', auth })

  for (const calendarId of selectedCalendarIds) {
    try {
      const events = await calendar.events.list({
        calendarId,
        privateExtendedProperty: `leaderai_post_id=${postId}`,
        maxResults: 10,
      })

      for (const event of events.data.items || []) {
        if (event.id) {
          await calendar.events.delete({ calendarId, eventId: event.id })
        }
      }
    } catch {}
  }

  return Response.json({ ok: true })
}
