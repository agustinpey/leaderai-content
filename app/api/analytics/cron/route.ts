import { supabaseAdmin } from '@/lib/supabase'
import Anthropic from '@anthropic-ai/sdk'
import { startOfWeek, endOfWeek, subWeeks, format } from 'date-fns'
import { NextRequest } from 'next/server'

/**
 * GET /api/analytics/cron
 * Cron job semanal — se ejecuta cada lunes a las 8am (configurado en vercel.json)
 * También puede llamarse manualmente con ?force=true
 *
 * Qué hace:
 * 1. Obtiene los posts publicados de la semana anterior con sus métricas
 * 2. Arma un análisis con Claude (qué funcionó, por qué, qué repetir)
 * 3. Guarda el insight semanal en Supabase
 * 4. Crea notificación para el usuario
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const force = searchParams.get('force') === 'true'

  // Verificar cron secret en producción
  const cronSecret = req.headers.get('authorization')
  if (!force && process.env.CRON_SECRET && cronSecret !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const weekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 })
  const weekEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 })

  // Verificar si ya existe insight para esta semana
  if (!force) {
    const { data: existing } = await supabaseAdmin
      .from('weekly_insights')
      .select('id')
      .eq('week_start', format(weekStart, 'yyyy-MM-dd'))
      .single()

    if (existing) {
      return Response.json({ message: 'Insight ya generado para esta semana', id: existing.id })
    }
  }

  // Obtener posts de la semana anterior
  const { data: posts, error } = await supabaseAdmin
    .from('posts')
    .select('*, metrics:post_metrics(*)')
    .eq('status', 'publicado')
    .gte('published_at', weekStart.toISOString())
    .lte('published_at', weekEnd.toISOString())

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const weekPosts = posts || []
  const withMetrics = weekPosts.filter((p: any) => p.metrics)

  // Calcular stats básicas
  const totalPosts = weekPosts.length
  const avgReach = withMetrics.length > 0
    ? Math.round(withMetrics.reduce((acc: number, p: any) => acc + (p.metrics?.reach || 0), 0) / withMetrics.length)
    : 0
  const avgSaves = withMetrics.length > 0
    ? Math.round(withMetrics.reduce((acc: number, p: any) => acc + (p.metrics?.saves || 0), 0) / withMetrics.length)
    : 0

  // Top post por saves
  const topPost = withMetrics.length > 0
    ? withMetrics.reduce((best: any, p: any) =>
        (p.metrics?.saves || 0) > (best?.metrics?.saves || 0) ? p : best, withMetrics[0])
    : null

  // Formato que más funcionó
  const formatSaves: Record<string, number[]> = {}
  withMetrics.forEach((p: any) => {
    if (!formatSaves[p.format]) formatSaves[p.format] = []
    formatSaves[p.format].push(p.metrics?.saves || 0)
  })
  const topFormat = Object.entries(formatSaves)
    .map(([fmt, saves]) => ({ fmt, avg: saves.reduce((a, b) => a + b, 0) / saves.length }))
    .sort((a, b) => b.avg - a.avg)[0]?.fmt || null

  // Si no hay posts, generar insight básico
  if (totalPosts === 0) {
    const { data: insight } = await supabaseAdmin
      .from('weekly_insights')
      .insert({
        week_start: format(weekStart, 'yyyy-MM-dd'),
        week_end: format(weekEnd, 'yyyy-MM-dd'),
        total_posts: 0,
        avg_reach: 0,
        avg_saves: 0,
        recommendations: [
          {
            titulo: 'Publicar consistentemente',
            descripcion: 'Esta semana no hubo posts. La consistencia es clave para el algoritmo.',
            accion: 'Programá al menos 3 Reels para la semana que viene',
          },
        ],
        raw_analysis: 'No hubo posts publicados esta semana.',
      })
      .select()
      .single()

    return Response.json({ message: 'Insight creado (sin posts)', insight })
  }

  // Armar prompt para Claude
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const postsDescription = withMetrics
    .map(
      (p: any) =>
        `- "${p.title}" (${p.format}): ${p.metrics?.reach || 0} reach, ${p.metrics?.saves || 0} saves, ${p.metrics?.likes || 0} likes, ${p.metrics?.plays || 0} plays${p.metrics?.retention_rate ? `, ${p.metrics.retention_rate}% retención` : ''}${p.hooks?.length ? `. Hook: "${p.hooks[0]}"` : ''}`
    )
    .join('\n')

  const prompt = `Soy Agustín Pey, fundador de LeaderAI. Esta semana publiqué ${totalPosts} posts de Instagram. Analizá el rendimiento y dame 3 recomendaciones específicas para la semana que viene.

POSTS DE ESTA SEMANA:
${postsDescription}

STATS:
- Reach promedio: ${avgReach}
- Saves promedio: ${avgSaves}
- Mejor formato: ${topFormat || 'no determinado'}
${topPost ? `- Post estrella: "${topPost.title}" (${topPost.metrics?.saves || 0} saves)` : ''}

Respondé con este formato JSON exacto (sin markdown, solo el JSON):
{
  "resumen": "2-3 oraciones sobre lo que funcionó esta semana",
  "patron_principal": "el patrón más importante detectado",
  "tipo_hook_efectivo": "descripción del tipo de hook que más retuvo",
  "recomendaciones": [
    {
      "titulo": "título corto",
      "descripcion": "qué hacer y por qué, basado en los datos reales",
      "accion": "acción concreta y específica"
    },
    {
      "titulo": "título corto",
      "descripcion": "qué hacer y por qué",
      "accion": "acción concreta"
    },
    {
      "titulo": "título corto",
      "descripcion": "qué hacer y por qué",
      "accion": "acción concreta"
    }
  ]
}`

  const message = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  const rawText = (message.content[0] as any).text
  let parsed: any = {}
  try {
    parsed = JSON.parse(rawText)
  } catch {
    parsed = { recomendaciones: [], resumen: rawText }
  }

  const { data: insight, error: insertError } = await supabaseAdmin
    .from('weekly_insights')
    .insert({
      week_start: format(weekStart, 'yyyy-MM-dd'),
      week_end: format(weekEnd, 'yyyy-MM-dd'),
      total_posts: totalPosts,
      avg_reach: avgReach,
      avg_saves: avgSaves,
      top_post_id: topPost?.id || null,
      top_format: topFormat,
      top_hook_type: parsed.tipo_hook_efectivo || null,
      recommendations: parsed.recomendaciones || [],
      raw_analysis: parsed.resumen || rawText,
    })
    .select()
    .single()

  if (insertError) return Response.json({ error: insertError.message }, { status: 500 })

  // Notificación de análisis listo
  await supabaseAdmin.from('notifications').insert({
    post_id: topPost?.id || null,
    message: `Análisis semanal listo — ${totalPosts} posts, ${avgSaves} avg saves. Ver recomendaciones.`,
    type: 'analisis_listo',
  })

  return Response.json({
    message: 'Análisis semanal generado',
    insight,
    stats: { totalPosts, avgReach, avgSaves, topFormat },
  })
}
