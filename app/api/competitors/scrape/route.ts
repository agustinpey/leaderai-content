import { supabaseAdmin } from '@/lib/supabase'
import { startInstagramScrapeRun, getRunStatus, getDatasetItems } from '@/lib/apify'
import { NextRequest } from 'next/server'

export const maxDuration = 30

export async function POST(req: NextRequest) {
  const apiToken = process.env.APIFY_API_TOKEN
  if (!apiToken) {
    return Response.json({ error: 'APIFY_API_TOKEN no configurado en Vercel' }, { status: 500 })
  }

  const body = await req.json().catch(() => ({}))
  const competitorId = body.competitor_id || null

  const query = supabaseAdmin.from('competitors').select('*').eq('active', true)
  if (competitorId) query.eq('id', competitorId)

  const { data: competitors, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!competitors?.length) return Response.json({ message: 'No hay referentes activos' })

  const usernames = competitors.map((c) => c.username)

  try {
    const { runId, datasetId } = await startInstagramScrapeRun(apiToken, usernames, 10)
    return Response.json({
      status: 'started',
      run_id: runId,
      dataset_id: datasetId,
      message: `Scrape iniciado para ${usernames.length} cuentas — puede tardar 2-3 minutos`,
    })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Error al iniciar el scrape' },
      { status: 500 }
    )
  }
}

// GET — chequea estado del run e importa resultados si terminó
export async function GET(req: NextRequest) {
  const apiToken = process.env.APIFY_API_TOKEN
  if (!apiToken) return Response.json({ error: 'APIFY_API_TOKEN no configurado' }, { status: 500 })

  const { searchParams } = new URL(req.url)
  const runId = searchParams.get('run_id')
  const datasetId = searchParams.get('dataset_id')
  if (!runId || !datasetId) return Response.json({ error: 'run_id y dataset_id requeridos' }, { status: 400 })

  const { status } = await getRunStatus(apiToken, runId)

  if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
    return Response.json({ status: 'failed', message: `El run de Apify terminó con estado: ${status}` })
  }

  if (status !== 'SUCCEEDED') {
    return Response.json({ status: 'running', message: 'Scrape en progreso...' })
  }

  // Run terminó — importar resultados
  const items = await getDatasetItems(apiToken, datasetId)

  // Obtener todos los competidores para mapear username → id
  const { data: competitors } = await supabaseAdmin.from('competitors').select('id, username')
  const competitorMap = Object.fromEntries((competitors || []).map((c) => [c.username.toLowerCase(), c.id]))

  let inserted = 0
  for (const item of items) {
    const username = (item.ownerUsername || '').toLowerCase()
    const competitorId = competitorMap[username]
    if (!competitorId) continue

    const hookText = item.caption?.split('\n')[0]?.slice(0, 200) || null
    const hashtags = item.caption?.match(/#\w+/g) || []
    const plays = item.videoViewCount || item.videoPlayCount || null

    const { data: comp } = await supabaseAdmin.from('competitors').select('follower_count').eq('id', competitorId).single()
    const engagementRate =
      comp?.follower_count && comp.follower_count > 0
        ? ((item.likesCount + item.commentsCount) / comp.follower_count) * 100
        : null

    await supabaseAdmin.from('competitor_posts').upsert(
      {
        competitor_id: competitorId,
        apify_post_id: item.id || item.shortCode,
        instagram_url: item.url,
        caption: item.caption || null,
        hook_text: hookText,
        hashtags,
        post_type: 'reel',
        likes: item.likesCount || 0,
        comments: item.commentsCount || 0,
        plays,
        engagement_rate: engagementRate ? parseFloat(engagementRate.toFixed(4)) : null,
        published_at: item.timestamp ? new Date(item.timestamp).toISOString() : null,
      },
      { onConflict: 'apify_post_id', ignoreDuplicates: false }
    )
    inserted++

    await supabaseAdmin
      .from('competitors')
      .update({ last_scraped_at: new Date().toISOString() })
      .eq('id', competitorId)
  }

  return Response.json({
    status: 'done',
    inserted,
    message: `${inserted} posts importados de ${Object.keys(competitorMap).length} cuentas`,
  })
}
