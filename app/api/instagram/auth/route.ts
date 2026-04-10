import { NextRequest } from 'next/server'

/**
 * GET /api/instagram/auth
 * Redirige al usuario al flujo OAuth de Meta/Facebook para Instagram Graph API.
 * Requiere: INSTAGRAM_APP_ID en .env.local
 */
export async function GET(req: NextRequest) {
  const appId = process.env.INSTAGRAM_APP_ID
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

  if (!appId) {
    return new Response(
      `<html><body style="font-family:sans-serif;background:#09090b;color:#a1a1aa;padding:40px;max-width:500px">
        <h2 style="color:#fafafa">Configuración incompleta</h2>
        <p>Necesitás configurar <code style="color:#e879f9">INSTAGRAM_APP_ID</code> en tu <code>.env.local</code>.</p>
        <h3 style="color:#fafafa;margin-top:24px">Cómo obtenerlo:</h3>
        <ol style="line-height:1.8">
          <li>Ir a <a href="https://developers.facebook.com" style="color:#60a5fa">developers.facebook.com</a></li>
          <li>Crear una app de tipo <strong>Business</strong></li>
          <li>Agregar el producto <strong>Instagram Graph API</strong></li>
          <li>En Configuración básica, copiá el <strong>App ID</strong> y el <strong>App Secret</strong></li>
          <li>En OAuth: agregar como redirect URI: <code>${baseUrl}/api/instagram/callback</code></li>
          <li>Agregar al .env.local:<br>
            <code>INSTAGRAM_APP_ID=tu_app_id</code><br>
            <code>INSTAGRAM_APP_SECRET=tu_app_secret</code>
          </li>
        </ol>
        <p style="margin-top:24px"><a href="/settings" style="color:#60a5fa">← Volver a Integraciones</a></p>
      </body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    )
  }

  const redirectUri = `${baseUrl}/api/instagram/callback`
  const scopes = [
    'instagram_basic',
    'instagram_manage_insights',
    'pages_show_list',
    'pages_read_engagement',
  ].join(',')

  const authUrl = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&response_type=code`

  return Response.redirect(authUrl)
}
