import { getIntegration } from '@/lib/integrations'
import { getZernioPosts } from '@/lib/zernio'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST() {
  const integration = await getIntegration('zernio')

  if (!integration?.access_token) {
    return Response.json({ error: 'Zernio no conectado' }, { status: 401 })
  }

  const apiKey = integration.access_token
  let synced = 0
  let errors = 0
  let page = 1
  let totalPages = 1

  while (page <= totalPages) {
    let result: Awaited<ReturnType<typeof getZernioPosts>>
    try {
      result = await getZernioPosts(apiKey, { limit: 50, page })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error Zernio'
      return Response.json({ error: msg }, { status: 400 })
    }

    totalPages = result.pagination?.pages || 1

    for (const zPost of result.posts || []) {
      try {
        const igPlatform = zPost.platforms?.find((p) => p.platform === 'instagram')
        if (!igPlatform) continue

        const igPostId = igPlatform.platformPostId
        const caption = zPost.content || ''
        const publishedAt = zPost.publishedAt
        const analytics = igPlatform.analytics || zPost.analytics

        // Determinar formato del post a partir de la URL
        const isReel = igPlatform.platformPostUrl?.includes('/reel/')
        const format = isReel ? 'reel' : 'foto'

        // Buscar post existente por instagram_post_id
        const { data: existing } = await supabaseAdmin
          .from('posts')
          .select('id')
          .eq('instagram_post_id', igPostId)
          .single()

        let postId = existing?.id

        if (!postId) {
          const title = caption.split('\n')[0]?.slice(0, 80) || `Post ${igPostId}`
          const { data: newPost } = await supabaseAdmin
            .from('posts')
            .insert({
              title,
              caption,
              format,
              status: 'publicado',
              instagram_post_id: igPostId,
              published_at: publishedAt,
            })
            .select('id')
            .single()
          postId = newPost?.id
        } else {
          await supabaseAdmin
            .from('posts')
            .update({ status: 'publicado', published_at: publishedAt })
            .eq('id', postId)
        }

        if (!postId) continue

        const metricsPayload = {
          likes: analytics.likes || 0,
          saves: analytics.saves || 0,
          reach: analytics.reach || 0,
          comments: analytics.comments || 0,
          shares: analytics.shares || 0,
          plays: analytics.views || analytics.impressions || 0,
          collected_at: new Date().toISOString(),
        }

        const { data: existingMetrics } = await supabaseAdmin
          .from('post_metrics')
          .select('id')
          .eq('post_id', postId)
          .single()

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

    page++
    if (page > 10) break // safety cap
  }

  return Response.json({
    synced,
    errors,
    message: `${synced} posts sincronizados desde Zernio`,
  })
}
