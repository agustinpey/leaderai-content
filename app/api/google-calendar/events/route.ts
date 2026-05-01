import { getIntegration } from '@/lib/integrations'
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

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month') // YYYY-MM

  const integration = await getIntegration('google_calendar')
  if (!integration?.access_token) {
    return Response.json({ events: [] })
  }

  try {
    const auth = getAuthClient(integration)
    const calendar = google.calendar({ version: 'v3', auth })

    let timeMin: Date
    let timeMax: Date

    if (month) {
      const [year, monthNum] = month.split('-').map(Number)
      timeMin = new Date(year, monthNum - 1, 1)
      timeMax = new Date(year, monthNum, 0, 23, 59, 59)
    } else {
      const now = new Date()
      timeMin = new Date(now.getFullYear(), now.getMonth(), 1)
      timeMax = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
    }

    const selectedCalendarIds: string[] = integration.metadata?.selected_calendar_ids || ['primary']
    const allEvents: any[] = []

    for (const calendarId of selectedCalendarIds) {
      try {
        const res = await calendar.events.list({
          calendarId,
          timeMin: timeMin.toISOString(),
          timeMax: timeMax.toISOString(),
          singleEvents: true,
          orderBy: 'startTime',
          maxResults: 200,
        })

        const events = (res.data.items || [])
          .filter((e) => !e.extendedProperties?.private?.leaderai_post_id)
          .map((e) => ({
            id: e.id,
            title: e.summary || 'Sin título',
            start: e.start?.dateTime || e.start?.date,
            end: e.end?.dateTime || e.end?.date,
            allDay: !e.start?.dateTime,
            calendarId,
          }))

        allEvents.push(...events)
      } catch {}
    }

    return Response.json({ events: allEvents })
  } catch (err: any) {
    return Response.json({ events: [], error: err.message })
  }
}
