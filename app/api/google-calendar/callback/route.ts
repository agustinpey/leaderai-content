import { NextRequest } from 'next/server'
import { google } from 'googleapis'
import { upsertIntegration } from '@/lib/integrations'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

  if (error || !code) {
    return Response.redirect(`${baseUrl}/settings?error=google_denied`)
  }

  const clientId = process.env.GOOGLE_CLIENT_ID!
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!
  const redirectUri = `${baseUrl}/api/google-calendar/callback`

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri)

  // Intercambiar code por tokens
  const { tokens } = await oauth2Client.getToken(code)
  oauth2Client.setCredentials(tokens)

  // Obtener la lista de calendarios para guardar metadata
  const calendarApi = google.calendar({ version: 'v3', auth: oauth2Client })
  const calendarList = await calendarApi.calendarList.list()
  const calendars = (calendarList.data.items || []).map((c) => ({
    id: c.id,
    summary: c.summary,
    primary: c.primary || false,
    backgroundColor: c.backgroundColor,
  }))

  // Por defecto, seleccionar el calendario primario
  const primaryCalendar = calendars.find((c) => c.primary)

  const expiresAt = tokens.expiry_date
    ? new Date(tokens.expiry_date).toISOString()
    : new Date(Date.now() + 60 * 60 * 1000).toISOString()

  await upsertIntegration(
    'google_calendar',
    {
      access_token: tokens.access_token || undefined,
      refresh_token: tokens.refresh_token || undefined,
      token_expires_at: expiresAt,
    },
    {
      calendars,
      selected_calendar_ids: primaryCalendar ? [primaryCalendar.id] : [],
    }
  )

  return Response.redirect(`${baseUrl}/settings?success=google_calendar`)
}
