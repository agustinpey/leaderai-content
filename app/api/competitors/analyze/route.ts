import { supabaseAdmin } from '@/lib/supabase'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 60

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const { competitor_id } = body

  let query = supabaseAdmin
    .from('competitor_posts')
    .select('*, competitor:competitors(username, follower_count, avg_engagement_rate)')
    .is('ai_topic', null)
    .order('scraped_at', { ascending: false })
    .limit(20)

  if (competitor_id) query = query.eq('competitor_id', competitor_id)

  const { data: posts, error } = await query

  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!posts?.length) return Response.json({ message: 'No hay posts pendientes de análisis', analyzed: 0 })

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const postsForAnalysis = posts.map((p, i) => ({
    index: i + 1,
    id: p.id,
    username: (p.competitor as any)?.username || 'desconocido',
    caption: p.caption?.slice(0, 300) || '',
    hook: p.hook_text || '',
    likes: p.likes,
    comments: p.comments,
    plays: p.plays,
    engagement_rate: p.engagement_rate,
    published_at: p.published_at,
  }))

  const prompt = `Analizá estos Reels de cuentas de Instagram del nicho de IA + ventas automatizadas + CRM. Para cada uno identificá:
1. El tema principal (ai_topic: ej "crm_automation", "ai_agents", "lead_conversion", "concesionarias", "herramientas_ia", "mentalidad_fundador", etc.)
2. El tipo de hook (ai_hook_type: "paradoja", "pregunta_dolor", "revelacion", "dato_estadistico", "historia", "demo", "otro")
3. El tipo de CTA (ai_cta_type: "comentar", "dm", "link_bio", "guardar", "compartir", "ninguno")
4. Si hay un gap de contenido para @agustin.peyy (ai_content_gap: true si este tema/ángulo performó bien Y la cuenta de Agustín no lo cubre frecuentemente)

Contexto: @agustin.peyy habla sobre agentes de IA, CRM automatizados, conversión de leads, LeaderAI (su empresa), y para fundadores/dueños de concesionarias y distribuidoras.

Posts a analizar:
${JSON.stringify(postsForAnalysis, null, 2)}

Respondé SOLO con un JSON array, sin markdown:
[
  {
    "id": "uuid-del-post",
    "ai_topic": "tema",
    "ai_hook_type": "tipo",
    "ai_cta_type": "tipo",
    "ai_content_gap": true/false
  }
]`

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }],
  })

  const rawText = (message.content[0] as any).text
  let analyzed: any[] = []
  try {
    // Claude a veces envuelve el JSON en ```json ... ```
    const jsonMatch = rawText.match(/\[[\s\S]*\]/)
    if (!jsonMatch) throw new Error('no array found')
    analyzed = JSON.parse(jsonMatch[0])
  } catch {
    return Response.json({ error: 'Claude no devolvió JSON válido', raw: rawText }, { status: 500 })
  }

  let updated = 0
  for (const item of analyzed) {
    const { error: updateErr } = await supabaseAdmin
      .from('competitor_posts')
      .update({
        ai_topic: item.ai_topic,
        ai_hook_type: item.ai_hook_type,
        ai_cta_type: item.ai_cta_type,
        ai_content_gap: item.ai_content_gap,
      })
      .eq('id', item.id)

    if (!updateErr) updated++
  }

  return Response.json({
    analyzed: updated,
    message: `${updated} posts analizados con Claude`,
  })
}
