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
  const tokenRes = await fetch(
    `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${appSecret}&code=${code}`
  )
  const tokenData = await tokenRes.json()

  if (tokenData.error) {
    return Response.redirect(`${baseUrl}/settings?error=instagram_token`)
  }

  // 2. Intercambiar por long-lived token (válido 60 días)
  const llRes = await fetch(
    `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${tokenData.access_token}`
  )
  const llData = await llRes.json()
  const longLivedToken = llData.access_token || tokenData.access_token

  // 3. Obtener las Pages del usuario y la cuenta de Instagram asociada
  const pagesRes = await fetch(
    `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,instagram_business_account&access_token=${longLivedToken}`
  )
  const pagesData = await pagesRes.json()

  let igAccountId = null
  let igUsername = null

  if (pagesData.data && pagesData.data.length > 0) {
    // Buscar la page que tiene Instagram Business Account
    for (const page of pagesData.data) {
      if (page.instagram_business_account) {
        igAccountId = page.instagram_business_account.id

        // Obtener username
        const igRes = await fetch(
          `https://graph.facebook.com/v21.0/${igAccountId}?fields=username,name&access_token=${longLivedToken}`
        )
        const igData = await igRes.json()
        igUsername = igData.username || igData.name
        break
      }
    }
  }

  // 4. Guardar en Supabase
  const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString() // 60 días
  await upsertIntegration(
    'instagram',
    { access_token: longLivedToken, token_expires_at: expiresAt },
    { ig_account_id: igAccountId, ig_username: igUsername }
  )

  return Response.redirect(`${baseUrl}/settings?success=instagram`)
}
