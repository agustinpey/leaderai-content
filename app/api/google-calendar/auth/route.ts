import { NextRequest } from 'next/server'
import { google } from 'googleapis'

export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

  if (!clientId || !clientSecret) {
    return new Response(
      `<html><body style="font-family:sans-serif;background:#09090b;color:#a1a1aa;padding:40px;max-width:500px">
        <h2 style="color:#fafafa">Configuración incompleta</h2>
        <p>Necesitás configurar las credenciales de Google OAuth en tu <code>.env.local</code>.</p>
        <h3 style="color:#fafafa;margin-top:24px">Cómo obtenerlas:</h3>
        <ol style="line-height:1.8">
          <li>Ir a <a href="https://console.cloud.google.com" style="color:#60a5fa">console.cloud.google.com</a></li>
          <li>Crear un proyecto nuevo o usar uno existente</li>
          <li>Ir a <strong>APIs y servicios → Biblioteca</strong> → buscar <strong>Google Calendar API</strong> → Habilitar</li>
          <li>Ir a <strong>APIs y servicios → Credenciales</strong> → Crear credenciales → <strong>ID de cliente de OAuth</strong></li>
          <li>Tipo de aplicación: <strong>Aplicación web</strong></li>
          <li>Agregar como URI de redireccionamiento: <code>${baseUrl}/api/google-calendar/callback</code></li>
          <li>También en <strong>Pantalla de consentimiento</strong>, agregar tu mail como usuario de prueba</li>
          <li>Agregar al .env.local:<br>
            <code>GOOGLE_CLIENT_ID=tu_client_id</code><br>
            <code>GOOGLE_CLIENT_SECRET=tu_client_secret</code>
          </li>
        </ol>
        <p style="margin-top:24px"><a href="/settings" style="color:#60a5fa">← Volver a Integraciones</a></p>
      </body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    )
  }

  const redirectUri = `${baseUrl}/api/google-calendar/callback`
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri)

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent', // fuerza a obtener refresh_token siempre
    scope: [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
    ],
  })

  return Response.redirect(authUrl)
}
