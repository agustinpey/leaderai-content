import { getIntegration } from '@/lib/integrations'
import { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const provider = searchParams.get('provider') as 'instagram' | 'google_calendar' | null

  if (!provider) {
    return Response.json({ error: 'provider requerido' }, { status: 400 })
  }

  try {
    const integration = await getIntegration(provider)
    return Response.json({
      connected: !!(integration?.access_token),
      metadata: integration?.metadata || {},
      expires_at: integration?.token_expires_at || null,
    })
  } catch {
    return Response.json({ connected: false, metadata: {} })
  }
}
