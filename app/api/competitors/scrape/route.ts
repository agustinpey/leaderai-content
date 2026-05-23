import { supabaseAdmin } from '@/lib/supabase'
import { scrapeInstagramReels } from '@/lib/apify'
import { NextRequest } from 'next/server'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const apiToken = process.env.APIFY_API_TOKEN
  if (!apiToken) {
    return Response.json({ error: 'APIFY_API_TOKEN no configurado' }, { status: 500 })
  }

  const body = await req.json().catch(() => ({}))
  const competitorId = body.competitor_id || null

  const query = supabaseAdmin.from('competitors').select('*').eq('active', true)
  if (competitorId) query.eq('id', competitorId)

  const { data: competitors, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!competitors?.length) return Response.json({ message: 'No hay competidores activos' })

  let totalInserted = 0
  let totalErrors = 0

  for (const competitor of competitors) {
    try {
      const reels = await scrapeInstagramReels(apiToken, [competitor.username], 20)

      for (const reel of reels) {
        const hookText = reel.caption?.split('\n')[0]?.slice(0, 200) || null
        const hashtags = reel.caption?.match(/#\w+/g) || []
        const plays = reel.videoViewCount || reel.videoPlayCount || null
        const engagementRate =
          competitor.follower_count && competitor.follower_count > 0
            ? ((reel.likesCount + reel.commentsCount) / competitor.follower_count) * 100
            : null

        await supabaseAdmin
          .from('competitor_posts')
          .upsert(
            {
              competitor_id: competitor.id,
              apify_post_id: reel.id || reel.shortCode,
              instagram_url: reel.url,
              caption: reel.caption || null,
              hook_text: hookText,
              hashtags,
              post_type: 'reel',
              likes: reel.likesCount || 0,
              comments: reel.commentsCount || 0,
              plays,
              engagement_rate: engagementRate ? parseFloat(engagementRate.toFixed(4)) : null,
              published_at: reel.timestamp ? new Date(reel.timestamp).toISOString() : null,
            },
            { onConflict: 'apify_post_id', ignoreDuplicates: false }
          )

        totalInserted++
      }

      // Actualizar last_scraped_at del competidor
      await supabaseAdmin
        .from('competitors')
        .update({ last_scraped_at: new Date().toISOString() })
        .eq('id', competitor.id)
    } catch {
      totalErrors++
    }
  }

  return Response.json({
    scraped: competitors.length,
    inserted: totalInserted,
    errors: totalErrors,
    message: `${totalInserted} Reels importados de ${competitors.length} cuentas`,
  })
}
