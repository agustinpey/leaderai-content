import { upsertIntegration } from '@/lib/integrations'
import { getZernioAccounts } from '@/lib/zernio'

export async function POST(req: Request) {
  const { api_key } = await req.json()

  if (!api_key?.startsWith('sk_')) {
    return Response.json({ error: 'API key inválida — debe empezar con sk_' }, { status: 400 })
  }

  // Verificar que la key funciona y obtener info de la cuenta
  let accounts: Awaited<ReturnType<typeof getZernioAccounts>>
  try {
    accounts = await getZernioAccounts(api_key)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al conectar con Zernio'
    return Response.json({ error: msg }, { status: 400 })
  }

  const igAccount = accounts.find((a) => a.platform === 'instagram')

  const { data, error } = await upsertIntegration(
    'zernio',
    { access_token: api_key },
    {
      zernio_username: igAccount?.username || null,
      zernio_account_id: igAccount?._id || null,
      display_name: igAccount?.displayName || null,
      followers_count: igAccount?.followersCount || null,
    }
  )

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({
    connected: true,
    username: igAccount?.username,
    message: `Conectado como @${igAccount?.username || 'cuenta'}`,
  })
}
