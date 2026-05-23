import { upsertIntegration } from '@/lib/integrations'
import { getZernioAccounts } from '@/lib/zernio'

export const maxDuration = 15

export async function POST(req: Request) {
  const { api_key } = await req.json()

  if (!api_key?.startsWith('sk_')) {
    return Response.json({ error: 'API key inválida — debe empezar con sk_' }, { status: 400 })
  }

  // Guardar la key primero
  const { error: saveError } = await upsertIntegration(
    'zernio',
    { access_token: api_key },
    {}
  )

  if (saveError) {
    return Response.json({ error: saveError.message }, { status: 500 })
  }

  // Intentar obtener info de cuenta con timeout de 8s (opcional — no bloquea)
  let username: string | null = null
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    const accounts = await Promise.race([
      getZernioAccounts(api_key),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 8000)
      ),
    ])
    clearTimeout(timeout)
    const igAccount = (accounts as Awaited<ReturnType<typeof getZernioAccounts>>).find(
      (a) => a.platform === 'instagram'
    )
    if (igAccount) {
      username = igAccount.username
      await upsertIntegration('zernio', { access_token: api_key }, {
        zernio_username: igAccount.username,
        zernio_account_id: igAccount._id,
        display_name: igAccount.displayName,
        followers_count: igAccount.followersCount,
      })
    }
  } catch {
    // Si falla o timeout, igual quedó guardada la key — el usuario puede sincronizar después
  }

  return Response.json({
    connected: true,
    username,
    message: username ? `Conectado como @${username}` : 'Conectado — sincronizá para verificar la cuenta',
  })
}
