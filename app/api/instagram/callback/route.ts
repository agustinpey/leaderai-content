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

  try {
    const appId = process.env.INSTAGRAM_APP_ID!
    const appSecret = process.env.INSTAGRAM_APP_SECRET!
    const redirectUri = `${baseUrl}/api/instagram/callback`

    // 1. Intercambiar code por user access token (Facebook OAuth)
    const tokenRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${appSecret}&code=${code}`
    )
    const tokenData = await tokenRes.json()

    if (tokenData.error || !tokenData.access_token) {
      throw new Error(tokenData.error?.message || 'No se obtuvo access_token')
    }

    const userToken = tokenData.access_token

    // 2. Long-lived token
    const llRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${userToken}`
    )
    const llData = await llRes.json()
    const longToken = llData.access_token || userToken

    // 3. Obtener páginas del usuario y la cuenta Instagram Business asociada
    const pagesRes = await fetch(
      `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,instagram_business_account{id,username,name}&access_token=${longToken}`
    )
    const pagesData = await pagesRes.json()

    let igAccountId = null
    let igUsername = null

    if (pagesData.data?.length > 0) {
      for (const page of pagesData.data) {
        if (page.instagram_business_account) {
          igAccountId = page.instagram_business_account.id
          igUsername = page.instagram_business_account.username || page.instagram_business_account.name
          break
        }
      }
    }

    // Fallback: buscar directo en /me
    if (!igAccountId) {
      const meRes = await fetch(
        `https://graph.facebook.com/v21.0/me?fields=instagram_business_account&access_token=${longToken}`
      )
      const meData = await meRes.json()
      if (meData.instagram_business_account) {
        igAccountId = meData.instagram_business_account.id
      }
    }

    const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString()

    await upsertIntegration(
      'instagram',
      { access_token: longToken, token_expires_at: expiresAt },
      {
        ig_account_id: igAccountId,
        ig_username: igUsername || 'agustin.peyy',
      }
    )

    return Response.redirect(`${baseUrl}/settings?success=instagram`)
  } catch (err: any) {
    console.error('Instagram callback error:', err?.message || err)
    return Response.redirect(
      `${baseUrl}/settings?error=instagram_callback&msg=${encodeURIComponent(err?.message || 'unknown')}`
    )
  }
}
