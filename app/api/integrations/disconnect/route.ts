import { disconnectIntegration } from '@/lib/integrations'
import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  const { provider } = await req.json()
  if (!provider) return Response.json({ error: 'provider requerido' }, { status: 400 })

  try {
    await disconnectIntegration(provider)
    return Response.json({ ok: true })
  } catch {
    return Response.json({ error: 'No se pudo desconectar' }, { status: 500 })
  }
}
