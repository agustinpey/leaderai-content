import { NextRequest } from 'next/server'
import { upsertIntegration } from '@/lib/integrations'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

  if (error || !code) {
    return Response.redirect(`${baseUrl}/settings?error=instagram_denied`)
  }

  const appId = process.env.INSTAGRAM_APP_ID!
  const appSecret = process.env.INSTAGRAM_APP_SECRET!
  const redirectUri = `${baseUrl}/api/instagram/callback`

  // 1. Intercambiar code por short-lived token
  const tokenRes = await fetch('https://api.instagram.com/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code,
    }),
  })
  const tokenData = await tokenRes.json()

  if (tokenData.error_type || !tokenData.access_token) {
    console.error('Instagram token error:', tokenData)
    return Response.redirect(`${baseUrl}/settings?error=instagram_token`)
  }

  const shortToken = tokenData.access_token
  const igUserId = tokenData.user_id

  // 2. Intercambiar por long-lived token (válido 60 días)
  const llRes = await fetch(
    `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${appSecret}&access_token=${shortToken}`
  )
  const llData = await llRes.json()
  const longToken = llData.access_token || shortToken

  // 3. Obtener username
  const profileRes = await fetch(
    `https://graph.instagram.com/v21.0/${igUserId}?fields=username,name&access_token=${longToken}`
  )
  const profileData = await profileRes.json()

  const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString()

  await upsertIntegration(
    'instagram',
    { access_token: longToken, token_expires_at: expiresAt },
    {
      ig_user_id: igUserId,
      ig_account_id: igUserId,
      ig_username: profileData.username || profileData.name || 'agustin.peyy',
    }
  )

  return Response.redirect(`${baseUrl}/settings?success=instagram`)
}
