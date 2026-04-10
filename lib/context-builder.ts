import { supabaseAdmin } from './supabase'
import { ContentContext, PostWithMetrics, WeeklyInsight } from './types'
import { format, subDays, subWeeks } from 'date-fns'

/**
 * context-builder.ts
 * El corazón de la app. Cada vez que se abre el chat,
 * Claude recibe el estado real de tu cuenta: qué posts tuviste,
 * cuáles ganaron, qué hooks funcionaron, qué recomienda el análisis semanal.
 * No es un chat en blanco — es un chat con memoria de tu cuenta.
 */

export async function buildContentContext(): Promise<ContentContext> {
  const thirtyDaysAgo = subDays(new Date(), 30).toISOString()
  const twoWeeksAgo = subWeeks(new Date(), 2).toISOString()

  const [recentPostsResult, topPostsResult, latestInsightResult, pendingPostsResult] =
    await Promise.all([
      // Últimos 10 posts con métricas
      supabaseAdmin
        .from('posts')
        .select(`*, metrics:post_metrics(*)`)
        .gte('created_at', thirtyDaysAgo)
        .order('created_at', { ascending: false })
        .limit(10),

      // Top 3 posts por saves en los últimos 30 días
      supabaseAdmin
        .from('posts')
        .select(`*, metrics:post_metrics(*)`)
        .eq('status', 'publicado')
        .gte('published_at', thirtyDaysAgo)
        .order('created_at', { ascending: false })
        .limit(20),

      // Último insight semanal
      supabaseAdmin
        .from('weekly_insights')
        .select('*')
        .order('week_start', { ascending: false })
        .limit(1)
        .single(),

      // Posts pendientes de publicar en los próximos 7 días
      supabaseAdmin
        .from('posts')
        .select('*')
        .in('status', ['listo', 'programado'])
        .order('scheduled_at', { ascending: true })
        .limit(5),
    ])

  const recentPosts = (recentPostsResult.data || []) as PostWithMetrics[]

  // Ordenar top posts por saves
  const allPublished = (topPostsResult.data || []) as PostWithMetrics[]
  const topPostsBySaves = allPublished
    .filter((p) => p.metrics && p.metrics.saves > 0)
    .sort((a, b) => (b.metrics?.saves || 0) - (a.metrics?.saves || 0))
    .slice(0, 3)

  const latestInsight =
    latestInsightResult.error ? null : (latestInsightResult.data as WeeklyInsight)

  const pendingPosts = pendingPostsResult.data || []

  return {
    recentPosts,
    topPostsBySaves,
    latestInsight,
    pendingPosts,
  }
}

export function formatContextForClaude(ctx: ContentContext): string {
  const lines: string[] = []

  lines.push('=== CONTEXTO DE TU CUENTA DE INSTAGRAM ===')
  lines.push(`Fecha: ${format(new Date(), 'dd/MM/yyyy')}`)
  lines.push('')

  // Posts recientes
  if (ctx.recentPosts.length > 0) {
    lines.push('--- POSTS RECIENTES (últimos 30 días) ---')
    ctx.recentPosts.forEach((post, i) => {
      lines.push(`${i + 1}. "${post.title}" | Formato: ${post.format} | Estado: ${post.status}`)
      if (post.published_at) {
        lines.push(`   Publicado: ${format(new Date(post.published_at), 'dd/MM/yyyy')}`)
      }
      if (post.metrics) {
        const m = post.metrics
        lines.push(
          `   Métricas: ${m.reach} reach | ${m.likes} likes | ${m.saves} saves | ${m.comments} comentarios | ${m.plays} plays`
        )
        if (m.retention_rate) {
          lines.push(`   Retención promedio: ${m.retention_rate}%`)
        }
      }
      if (post.hooks && post.hooks.length > 0) {
        lines.push(`   Hook usado: "${post.hooks[0]}"`)
      }
      if (post.tags && post.tags.length > 0) {
        lines.push(`   Tags: ${post.tags.join(', ')}`)
      }
    })
    lines.push('')
  }

  // Top posts
  if (ctx.topPostsBySaves.length > 0) {
    lines.push('--- TOP POSTS POR SAVES (este mes) ---')
    ctx.topPostsBySaves.forEach((post, i) => {
      const m = post.metrics
      lines.push(`${i + 1}. "${post.title}" — ${m?.saves || 0} saves | ${m?.reach || 0} reach`)
      if (post.hooks && post.hooks.length > 0) {
        lines.push(`   Hook: "${post.hooks[0]}"`)
      }
      lines.push(`   Formato: ${post.format}`)
    })
    lines.push('')
  }

  // Último análisis semanal
  if (ctx.latestInsight) {
    const ins = ctx.latestInsight
    lines.push('--- ÚLTIMO ANÁLISIS SEMANAL ---')
    lines.push(
      `Semana del ${format(new Date(ins.week_start), 'dd/MM')} al ${format(new Date(ins.week_end), 'dd/MM')}`
    )
    lines.push(`Posts publicados: ${ins.total_posts}`)
    lines.push(`Reach promedio: ${ins.avg_reach} | Saves promedio: ${ins.avg_saves}`)
    if (ins.top_format) lines.push(`Formato que más funcionó: ${ins.top_format}`)
    if (ins.top_hook_type) lines.push(`Tipo de hook más efectivo: ${ins.top_hook_type}`)

    if (ins.recommendations && ins.recommendations.length > 0) {
      lines.push('Recomendaciones para esta semana:')
      ins.recommendations.forEach((rec, i) => {
        lines.push(`  ${i + 1}. ${rec.titulo}: ${rec.descripcion}`)
        lines.push(`     Acción: ${rec.accion}`)
      })
    }
    lines.push('')
  }

  // Posts pendientes
  if (ctx.pendingPosts.length > 0) {
    lines.push('--- CONTENIDO PENDIENTE ---')
    ctx.pendingPosts.forEach((post) => {
      const schedDate = post.scheduled_at
        ? format(new Date(post.scheduled_at), 'dd/MM HH:mm')
        : 'sin fecha'
      lines.push(`- "${post.title}" | ${post.format} | ${post.status} | ${schedDate}`)
    })
    lines.push('')
  }

  lines.push('=== FIN DE CONTEXTO ===')
  lines.push('')
  lines.push(
    'Con este contexto, ayudame a generar contenido que esté alineado con lo que ya funcionó en mi cuenta.'
  )

  return lines.join('\n')
}
