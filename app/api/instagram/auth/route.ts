import { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const appId = process.env.INSTAGRAM_APP_ID
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

  if (!appId) {
    return Response.json({ error: 'INSTAGRAM_APP_ID no configurado' }, { status: 500 })
  }

  const redirectUri = `${baseUrl}/api/instagram/callback`

  const scopes = [
    'instagram_business_basic',
    'instagram_business_manage_insights',
    'instagram_business_content_publish',
  ].join(',')

  // Instagram Business Login OAuth
  const authUrl = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&response_type=code`

  return Response.redirect(authUrl)
}
