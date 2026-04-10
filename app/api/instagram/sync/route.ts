import { getIntegration } from '@/lib/integrations'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * POST /api/instagram/sync
 * Obtiene los últimos Reels/posts de Instagram Graph API,
 * los matchea con posts en la DB (por instagram_post_id),
 * y actualiza/crea las métricas.
 */
export async function POST() {
  const integration = await getIntegration('instagram')

  if (!integration?.access_token) {
    return Response.json({ error: 'Instagram no conectado' }, { status: 401 })
  }

  const token = integration.access_token
  const igAccountId = integration.metadata?.ig_account_id

  if (!igAccountId) {
    return Response.json({ error: 'No se encontró la cuenta de Instagram Business' }, { status: 400 })
  }

  // 1. Obtener media reciente (últimos 25 posts)
  const mediaRes = await fetch(
    `https://graph.facebook.com/v21.0/${igAccountId}/media?fields=id,caption,media_type,timestamp,permalink&limit=25&access_token=${token}`
  )
  const mediaData = await mediaRes.json()

  if (mediaData.error) {
    return Response.json({ error: mediaData.error.message }, { status: 400 })
  }

  const mediaItems = mediaData.data || []
  let synced = 0
  let errors = 0

  for (const item of mediaItems) {
    try {
      // 2. Obtener insights de cada media item
      const insightFields =
        item.media_type === 'VIDEO' || item.media_type === 'REELS'
          ? 'reach,saved,likes,comments,shares,plays,total_interactions'
          : 'reach,saved,likes,comments,shares,total_interactions'

      const insightRes = await fetch(
        `https://graph.facebook.com/v21.0/${item.id}/insights?metric=${insightFields}&access_token=${token}`
      )
      const insightData = await insightRes.json()

      if (insightData.error) continue

      // Mapear insights a un objeto plano
      const metrics: Record<string, number> = {}
      for (const insight of insightData.data || []) {
        metrics[insight.name] = insight.values?.[0]?.value || insight.value || 0
      }

      // 3. Buscar post en la DB por instagram_post_id
      const { data: existingPost } = await supabaseAdmin
        .from('posts')
        .select('id')
        .eq('instagram_post_id', item.id)
        .single()

      let postId = existingPost?.id

      // Si no existe, crear el post a partir de los datos de Instagram
      if (!postId) {
        const caption = item.caption || ''
        const title = caption.split('\n')[0]?.slice(0, 80) || `Post ${item.id}`
        const format =
          item.media_type === 'VIDEO' || item.media_type === 'REELS'
            ? 'reel'
            : item.media_type === 'CAROUSEL_ALBUM'
            ? 'carrusel'
            : item.media_type === 'IMAGE'
            ? 'foto'
            : 'reel'

        const { data: newPost } = await supabaseAdmin
          .from('posts')
          .insert({
            title,
            caption,
            format,
            status: 'publicado',
            instagram_post_id: item.id,
            published_at: item.timestamp,
          })
          .select()
          .single()

        postId = newPost?.id
      } else {
        // Actualizar instagram_post_id si faltaba
        await supabaseAdmin
          .from('posts')
          .update({ instagram_post_id: item.id, status: 'publicado', published_at: item.timestamp })
          .eq('id', postId)
      }

      if (!postId) continue

      // 4. Upsert métricas
      const { data: existingMetrics } = await supabaseAdmin
        .from('post_metrics')
        .select('id')
        .eq('post_id', postId)
        .single()

      const metricsPayload = {
        likes: metrics.likes || 0,
        saves: metrics.saved || 0,
        reach: metrics.reach || 0,
        comments: metrics.comments || 0,
        shares: metrics.shares || 0,
        plays: metrics.plays || metrics.video_views || 0,
        collected_at: new Date().toISOString(),
      }

      if (existingMetrics) {
        await supabaseAdmin
          .from('post_metrics')
          .update(metricsPayload)
          .eq('id', existingMetrics.id)
      } else {
        await supabaseAdmin
          .from('post_metrics')
          .insert({ post_id: postId, ...metricsPayload })
      }

      synced++
    } catch {
      errors++
    }
  }

  return Response.json({
    synced,
    errors,
    total: mediaItems.length,
    message: `${synced} posts sincronizados desde Instagram`,
  })
}
