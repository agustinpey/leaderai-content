import { supabaseAdmin } from './supabase'
import { ContentContext, PostWithMetrics, WeeklyInsight, CompetitorPost } from './types'
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

  const [recentPostsResult, topPostsResult, latestInsightResult, pendingPostsResult, analyzedPostsResult, competitorPostsResult] =
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

      // Posts propios analizados con feedback de IA
      supabaseAdmin
        .from('posts')
        .select(`*, metrics:post_metrics(*)`)
        .not('ai_analysis', 'is', null)
        .order('ai_analyzed_at', { ascending: false })
        .limit(6),

      // Posts de referentes con análisis IA
      supabaseAdmin
        .from('competitor_posts')
        .select(`*, competitor:competitors(username, display_name)`)
        .not('ai_topic', 'is', null)
        .order('engagement_rate', { ascending: false })
        .limit(15),
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

  const analyzedPosts = (analyzedPostsResult.data || []) as PostWithMetrics[]

  // Mapear competitor posts con username del referente
  const rawCompetitorPosts = competitorPostsResult.data || []
  const competitorPosts: CompetitorPost[] = rawCompetitorPosts.map((p: any) => ({
    id: p.id,
    competitor_id: p.competitor_id,
    competitor_username: p.competitor?.username || 'desconocido',
    caption: p.caption,
    hook_text: p.hook_text,
    post_type: p.post_type,
    likes: p.likes || 0,
    comments: p.comments || 0,
    plays: p.plays,
    engagement_rate: p.engagement_rate,
    published_at: p.published_at,
    ai_topic: p.ai_topic,
    ai_hook_type: p.ai_hook_type,
    ai_cta_type: p.ai_cta_type,
    ai_content_gap: p.ai_content_gap || false,
  }))

  return {
    recentPosts,
    topPostsBySaves,
    latestInsight,
    pendingPosts,
    analyzedPosts,
    competitorPosts,
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

  // Análisis de reels propios (feedback guardado)
  if (ctx.analyzedPosts.length > 0) {
    lines.push('--- FEEDBACK DE REELS ANALIZADOS ---')
    ctx.analyzedPosts.forEach((post) => {
      const m = post.metrics
      lines.push(`"${post.title}" | ${post.format} | ${m ? `${m.saves} saves · ${m.reach} reach` : 'sin métricas'}`)
      if (post.ai_analysis) {
        const analysisLines = post.ai_analysis.split('\n')
        const mejIdx = analysisLines.findIndex(l => l.includes('TOP 3 MEJORAS') || l.includes('MEJORAS PARA'))
        const puntuacion = analysisLines.find(l => l.includes('PUNTUACIÓN') || l.includes('PUNTAJE'))
        if (mejIdx >= 0) {
          lines.push('  Mejoras detectadas:')
          analysisLines.slice(mejIdx + 1, mejIdx + 5).filter(l => l.trim()).forEach(l => lines.push(`    ${l.trim()}`))
        }
        if (puntuacion) lines.push(`  ${puntuacion.trim()}`)
      }
    })
    lines.push('')
  }

  // Referentes: posts analizados con IA
  if (ctx.competitorPosts.length > 0) {
    lines.push('--- REFERENTES (posts analizados) ---')

    // Agrupar por referente
    const byCompetitor: Record<string, typeof ctx.competitorPosts> = {}
    ctx.competitorPosts.forEach(p => {
      if (!byCompetitor[p.competitor_username]) byCompetitor[p.competitor_username] = []
      byCompetitor[p.competitor_username].push(p)
    })

    Object.entries(byCompetitor).forEach(([username, posts]) => {
      lines.push(`@${username} (${posts.length} posts analizados):`)
      posts.slice(0, 3).forEach(p => {
        const eng = p.engagement_rate ? `${(p.engagement_rate * 100).toFixed(1)}% eng` : ''
        const topic = p.ai_topic ? `tema: ${p.ai_topic}` : ''
        const hookType = p.ai_hook_type ? `hook: ${p.ai_hook_type}` : ''
        const gap = p.ai_content_gap ? ' ★ GAP (vos no lo cubriste)' : ''
        lines.push(`  - [${p.post_type || 'reel'}] ${[eng, topic, hookType].filter(Boolean).join(' | ')}${gap}`)
        if (p.hook_text) lines.push(`    Hook: "${p.hook_text.slice(0, 120)}"`)
      })
    })

    // Gaps específicos
    const gaps = ctx.competitorPosts.filter(p => p.ai_content_gap)
    if (gaps.length > 0) {
      lines.push('')
      lines.push('Oportunidades de contenido (temas que ellos cubrieron y vos no):')
      gaps.forEach(p => {
        lines.push(`  ★ "${p.ai_topic}" — @${p.competitor_username}${p.hook_text ? ` — hook: "${p.hook_text.slice(0, 80)}"` : ''}`)
      })
    }
    lines.push('')
  }

  lines.push('=== FIN DE CONTEXTO ===')
  lines.push('')
  lines.push(
    'Con este contexto, ayudame a generar contenido que esté alineado con lo que ya funcionó en mi cuenta.'
  )

  return lines.join('\n')
}
