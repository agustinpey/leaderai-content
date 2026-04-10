import { supabaseAdmin } from './supabase'

export type Provider = 'instagram' | 'google_calendar'

export async function getIntegration(provider: Provider) {
  const { data, error } = await supabaseAdmin
    .from('integrations')
    .select('*')
    .eq('provider', provider)
    .single()

  if (error) return null
  return data
}

export async function upsertIntegration(
  provider: Provider,
  tokens: {
    access_token?: string
    refresh_token?: string
    token_expires_at?: string
  },
  metadata?: Record<string, any>
) {
  const existing = await getIntegration(provider)

  if (existing) {
    const { data, error } = await supabaseAdmin
      .from('integrations')
      .update({
        ...tokens,
        metadata: { ...existing.metadata, ...(metadata || {}) },
        updated_at: new Date().toISOString(),
      })
      .eq('provider', provider)
      .select()
      .single()

    return { data, error }
  } else {
    const { data, error } = await supabaseAdmin
      .from('integrations')
      .insert({
        provider,
        ...tokens,
        metadata: metadata || {},
      })
      .select()
      .single()

    return { data, error }
  }
}

export async function disconnectIntegration(provider: Provider) {
  return supabaseAdmin.from('integrations').delete().eq('provider', provider)
}

export async function isConnected(provider: Provider): Promise<boolean> {
  const integration = await getIntegration(provider)
  return !!(integration?.access_token)
}
