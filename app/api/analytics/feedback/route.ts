import { supabaseAdmin } from '@/lib/supabase'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 45

export async function POST() {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return Response.json({ error: 'ANTHROPIC_API_KEY no configurado' }, { status: 500 })

  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

  const [{ data: posts }, { data: competitorPosts }] = await Promise.all([
    supabaseAdmin
      .from('posts')
      .select('*, metrics:post_metrics(*)')
      .eq('status', 'publicado')
      .gte('published_at', since)
      .order('published_at', { ascending: false }),
    supabaseAdmin
      .from('competitor_posts')
      .select('*, competitor:competitors(username)')
      .not('ai_topic', 'is', null)
      .order('likes', { ascending: false })
      .limit(30),
  ])

  const ownPosts = (posts || []).map((p: any) => ({
    ...p,
    metrics: Array.isArray(p.metrics) ? p.metrics[0] ?? null : p.metrics,
  }))

  const ownSummary = ownPosts.map((p: any) => ({
    title: p.title,
    format: p.format,
    likes: p.metrics?.likes ?? 0,
    saves: p.metrics?.saves ?? 0,
    reach: p.metrics?.reach ?? 0,
    plays: p.metrics?.plays ?? 0,
  }))

  const competitorSummary = (competitorPosts || []).map((p: any) => ({
    username: p.competitor?.username,
    topic: p.ai_topic,
    hook_type: p.ai_hook_type,
    cta_type: p.ai_cta_type,
    likes: p.likes,
    plays: p.plays,
    is_gap: p.ai_content_gap,
  }))

  const prompt = `Sos un estratega de contenido para marca personal en Instagram. Analizá los datos de performance de Agustín Pey (@agustin.peyy) y devolve feedback accionable.

CONTEXTO DE MARCA: Agustín es fundador de LeaderAI — automatización con IA para convertir conversaciones en ventas. Habla a dueños de negocio con leads que no convierten. Recién está comenzando en Instagram (pocos seguidores, solo 2 reels publicados).

POSTS PROPIOS (últimos 90 días):
${JSON.stringify(ownSummary, null, 2)}

TOP POSTS DE REFERENTES:
${JSON.stringify(competitorSummary.slice(0, 20), null, 2)}

INSTRUCCIONES:
- Considerá que el usuario tiene muy poca data propia (solo ${ownPosts.length} post/s publicado/s)
- Dá feedback honesto pero constructivo para alguien que recién empieza
- Comparé con los referentes para identificar oportunidades
- Enfocate en los próximos 30 días

Respondé con JSON exacto (sin texto adicional):
{
  "estado_actual": "una frase corta describiendo dónde está el canal ahora",
  "puntos_fuertes": ["máx 2 cosas positivas basadas en datos"],
  "oportunidades": [
    {
      "titulo": "nombre corto",
      "descripcion": "qué hacer y por qué funciona",
      "accion": "acción concreta para los próximos 7 días"
    }
  ],
  "temas_gap": ["tema 1", "tema 2", "tema 3"],
  "hook_que_mas_funciona_en_referentes": "tipo de hook con ejemplo",
  "proxima_semana": "una sola recomendación prioritaria"
}`

  let text = ''
  try {
    const client = new Anthropic({ apiKey })
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    })
    text = message.content[0].type === 'text' ? message.content[0].text : ''
  } catch (err: any) {
    return Response.json({ error: `Error de IA: ${err?.message || 'desconocido'}` }, { status: 500 })
  }

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return Response.json({ error: 'No se pudo parsear la respuesta de Claude' }, { status: 500 })

  try {
    return Response.json(JSON.parse(jsonMatch[0]))
  } catch {
    return Response.json({ error: 'JSON inválido en respuesta de Claude' }, { status: 500 })
  }
}
