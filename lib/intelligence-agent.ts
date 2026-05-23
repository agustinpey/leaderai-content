import { supabaseAdmin } from './supabase'
import Anthropic from '@anthropic-ai/sdk'
import { readFileSync } from 'fs'
import { join } from 'path'
import type { PostWithMetrics } from './types'

export interface ContentIdea {
  title: string
  pain_point: string
  content_angle: string
  why_now: string | null
  format_suggestion: 'reel' | 'carrusel' | 'historia' | 'foto'
  topic_tag: string
  estimated_performance: 'bajo' | 'medio' | 'alto' | 'viral'
  hooks: string[]
  source: 'competitor_gap' | 'own_performance' | 'niche_research' | 'manual'
}

export interface IntelligenceContext {
  winningPosts: PostWithMetrics[]
  competitorGaps: { username: string; topic: string; hook_type: string; plays: number; likes: number }[]
  savesThreshold: number
  previousIdeasFeedback: { title: string; estimated: string; actual_save_rate: number | null }[]
}

export function calculateSavesThreshold(posts: PostWithMetrics[]): number {
  const withMetrics = posts.filter((p) => p.metrics && p.metrics.reach > 0)
  if (withMetrics.length === 0) return 3

  const rates = withMetrics.map((p) => {
    const m = p.metrics!
    return m.reach > 0 ? (m.saves / m.reach) * 100 : 0
  })

  rates.sort((a, b) => a - b)
  const mid = Math.floor(rates.length / 2)
  const median = rates.length % 2 === 0
    ? (rates[mid - 1] + rates[mid]) / 2
    : rates[mid]

  return Math.max(1, parseFloat((median * 1.5).toFixed(2)))
}

export function identifyWinningPosts(posts: PostWithMetrics[], threshold: number): PostWithMetrics[] {
  return posts.filter((p) => {
    if (!p.metrics || p.metrics.reach === 0) return false
    const saveRate = (p.metrics.saves / p.metrics.reach) * 100
    return saveRate >= threshold
  })
}

export async function buildIntelligenceContext(): Promise<IntelligenceContext> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [postsRes, competitorGapsRes, ideasFeedbackRes] = await Promise.all([
    supabaseAdmin
      .from('posts')
      .select('*, metrics:post_metrics(*)')
      .eq('status', 'publicado')
      .gte('published_at', thirtyDaysAgo)
      .order('published_at', { ascending: false })
      .limit(30),

    supabaseAdmin
      .from('competitor_posts')
      .select('id, hook_text, ai_topic, ai_hook_type, likes, plays, competitor:competitors(username)')
      .eq('ai_content_gap', true)
      .order('likes', { ascending: false })
      .limit(20),

    supabaseAdmin
      .from('content_ideas')
      .select('title, estimated_performance, actual_save_rate')
      .not('converted_to_post_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  const posts = (postsRes.data || []) as PostWithMetrics[]
  const threshold = calculateSavesThreshold(posts)
  const winningPosts = identifyWinningPosts(posts, threshold)

  const gaps = (competitorGapsRes.data || []).map((p: any) => ({
    username: p.competitor?.username || 'desconocido',
    topic: p.ai_topic || 'sin_clasificar',
    hook_type: p.ai_hook_type || 'otro',
    plays: p.plays || 0,
    likes: p.likes || 0,
  }))

  const feedback = (ideasFeedbackRes.data || []).map((i: any) => ({
    title: i.title,
    estimated: i.estimated_performance,
    actual_save_rate: i.actual_save_rate,
  }))

  return { winningPosts, competitorGaps: gaps, savesThreshold: threshold, previousIdeasFeedback: feedback }
}

export function buildIdeaGenerationPrompt(ctx: IntelligenceContext, claudeMd: string): string {
  const winningSection = ctx.winningPosts.length > 0
    ? `POSTS GANADORES (saves_rate > ${ctx.savesThreshold.toFixed(1)}% — tu umbral actual):
${ctx.winningPosts.map((p) => {
  const m = p.metrics!
  const sr = ((m.saves / m.reach) * 100).toFixed(1)
  return `- "${p.title}" (${p.format}): ${sr}% saves_rate, ${m.reach} reach${p.hooks?.length ? `. Hook: "${p.hooks[0]}"` : ''}`
}).join('\n')}`
    : 'Sin posts ganadores este mes todavía.'

  const gapsSection = ctx.competitorGaps.length > 0
    ? `GAPS DE CONTENIDO (competidores que performen bien en temas que vos no cubrís):
${ctx.competitorGaps.map((g) => `- @${g.username}: tema "${g.topic}", hook "${g.hook_type}", ${g.plays || g.likes} interacciones`).join('\n')}`
    : 'Sin gaps de competidores detectados aún.'

  const feedbackSection = ctx.previousIdeasFeedback.length > 0
    ? `CALIBRACIÓN (ideas previas vs. resultado real):
${ctx.previousIdeasFeedback.map((i) => `- "${i.title}" → estimé: ${i.estimated}, real: ${i.actual_save_rate != null ? `${i.actual_save_rate.toFixed(1)}% saves` : 'sin datos aún'}`).join('\n')}`
    : ''

  return `Sos el agente de contenido de Agustín Pey (@agustin.peyy), fundador de LeaderAI.

POSICIONAMIENTO DE MARCA:
${claudeMd.slice(0, 2000)}

---

${winningSection}

${gapsSection}

${feedbackSection ? feedbackSection + '\n' : ''}
NICHOS EN LOS QUE HAY QUE GENERAR IDEAS (solo estos, sin mezclar con otros):
- Agentes de IA para ventas y conversión de leads
- CRM automatizados (GHL, WhatsApp automation)
- Gestión de base de datos / operaciones con IA
- Agentes de IA para concesionarias y distribuidoras
- Mentalidad y procesos del fundador de empresa de automatización
- Crecimiento personal del founder (sin coaching genérico, siempre anclado al negocio)

REGLAS PARA LAS IDEAS:
- Cada idea debe identificar un dolor específico que la audiencia busca activamente
- No ideas genéricas como "beneficios de la IA" — siempre anclar al problema concreto
- Los hooks deben seguir los 3 tipos del CLAUDE.md: paradoja, revelación, o pregunta de dolor
- Formato reel para temas de acción rápida, carrusel para tutoriales/listas
- Estimá el performance basándote en el historial real de Agustín

Generá exactamente 12 ideas de contenido en JSON array. Sin markdown, solo el array:

[
  {
    "title": "título del reel/carrusel (max 80 chars)",
    "pain_point": "el dolor específico que siente el ICP (1-2 oraciones, directo)",
    "content_angle": "el ángulo único de Agustín para este tema (qué lo hace diferente al resto)",
    "why_now": "por qué este tema es relevante ahora mismo (o null)",
    "format_suggestion": "reel|carrusel|foto|historia",
    "topic_tag": "uno de: ai_agents|crm_automation|database_ops|concesionarias|founder_growth|lead_conversion",
    "estimated_performance": "bajo|medio|alto|viral",
    "hooks": ["hook paradoja", "hook revelacion", "hook pregunta_dolor"],
    "source": "competitor_gap|own_performance|niche_research"
  }
]`
}

export async function generateContentIdeas(ctx: IntelligenceContext): Promise<ContentIdea[]> {
  let claudeMd = ''
  try {
    claudeMd = readFileSync(join(process.cwd(), 'CLAUDE.md'), 'utf-8')
  } catch {}

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  const prompt = buildIdeaGenerationPrompt(ctx, claudeMd)

  const message = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 4000,
    system: 'Sos un estratega de contenido de Instagram especializado en IA, automatización de ventas y CRM. Respondés SOLO con JSON válido, sin markdown, sin texto extra.',
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = (message.content[0] as any).text
  const ideas: ContentIdea[] = JSON.parse(raw)
  return ideas
}
