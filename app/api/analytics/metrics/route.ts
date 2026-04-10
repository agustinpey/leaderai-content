import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'

// GET /api/analytics/metrics — métricas agregadas
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const days = parseInt(searchParams.get('days') || '30')

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const { data: posts, error } = await supabaseAdmin
    .from('posts')
    .select('*, metrics:post_metrics(*)')
    .eq('status', 'publicado')
    .gte('published_at', since)
    .order('published_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const published = posts || []
  const withMetrics = published.filter((p: any) => p.metrics)

  if (withMetrics.length === 0) {
    return Response.json({
      posts: published,
      summary: { total: published.length, avgReach: 0, avgSaves: 0, avgLikes: 0, avgPlays: 0 },
      topBySaves: [],
      topByReach: [],
      byFormat: {},
    })
  }

  const sum = (key: string) =>
    withMetrics.reduce((acc: number, p: any) => acc + (p.metrics?.[key] || 0), 0)

  const avg = (key: string) => Math.round(sum(key) / withMetrics.length)

  // Top por saves
  const topBySaves = [...withMetrics]
    .sort((a: any, b: any) => (b.metrics?.saves || 0) - (a.metrics?.saves || 0))
    .slice(0, 5)

  // Top por reach
  const topByReach = [...withMetrics]
    .sort((a: any, b: any) => (b.metrics?.reach || 0) - (a.metrics?.reach || 0))
    .slice(0, 5)

  // Agrupado por formato
  const byFormat: Record<string, { count: number; avgSaves: number; avgReach: number }> = {}
  withMetrics.forEach((p: any) => {
    const fmt = p.format
    if (!byFormat[fmt]) byFormat[fmt] = { count: 0, avgSaves: 0, avgReach: 0 }
    byFormat[fmt].count++
    byFormat[fmt].avgSaves += p.metrics?.saves || 0
    byFormat[fmt].avgReach += p.metrics?.reach || 0
  })
  Object.keys(byFormat).forEach((fmt) => {
    byFormat[fmt].avgSaves = Math.round(byFormat[fmt].avgSaves / byFormat[fmt].count)
    byFormat[fmt].avgReach = Math.round(byFormat[fmt].avgReach / byFormat[fmt].count)
  })

  return Response.json({
    posts: published,
    summary: {
      total: published.length,
      avgReach: avg('reach'),
      avgSaves: avg('saves'),
      avgLikes: avg('likes'),
      avgPlays: avg('plays'),
    },
    topBySaves,
    topByReach,
    byFormat,
  })
}

// POST /api/analytics/metrics — cargar métricas manualmente para un post
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { post_id, likes, saves, reach, comments, shares, plays, retention_rate } = body

  if (!post_id) return Response.json({ error: 'post_id requerido' }, { status: 400 })

  // Upsert (una sola entrada de métricas por post)
  const { data: existing } = await supabaseAdmin
    .from('post_metrics')
    .select('id')
    .eq('post_id', post_id)
    .single()

  let result
  if (existing) {
    result = await supabaseAdmin
      .from('post_metrics')
      .update({ likes, saves, reach, comments, shares, plays, retention_rate, collected_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select()
      .single()
  } else {
    result = await supabaseAdmin
      .from('post_metrics')
      .insert({ post_id, likes, saves, reach, comments, shares, plays, retention_rate })
      .select()
      .single()
  }

  if (result.error) return Response.json({ error: result.error.message }, { status: 500 })

  // Marcar post como publicado si no lo estaba
  await supabaseAdmin
    .from('posts')
    .update({ status: 'publicado', published_at: new Date().toISOString() })
    .eq('id', post_id)
    .eq('status', 'programado')

  // Crear notificación de análisis listo
  await supabaseAdmin.from('notifications').insert({
    post_id,
    message: 'Métricas cargadas — el próximo análisis semanal las incluirá',
    type: 'analisis_listo',
  })

  return Response.json(result.data, { status: 201 })
}
