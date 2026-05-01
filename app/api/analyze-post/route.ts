import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: Request) {
  const { postId } = await req.json()

  if (!postId) {
    return Response.json({ error: 'postId requerido' }, { status: 400 })
  }

  const { data: post, error } = await supabaseAdmin
    .from('posts')
    .select(`
      id, title, caption, script, format, published_at,
      metrics:post_metrics(likes, saves, reach, comments, shares, plays)
    `)
    .eq('id', postId)
    .single()

  if (error || !post) {
    return Response.json({ error: 'Post no encontrado' }, { status: 404 })
  }

  const metrics = Array.isArray(post.metrics) ? post.metrics[0] : post.metrics

  const savesRate =
    metrics?.reach > 0
      ? ((metrics.saves / metrics.reach) * 100).toFixed(1)
      : null

  const engagementRate =
    metrics?.reach > 0
      ? (
          ((metrics.likes + metrics.saves + metrics.comments) / metrics.reach) *
          100
        ).toFixed(1)
      : null

  const playsToReach =
    metrics?.reach > 0 && metrics?.plays > 0
      ? ((metrics.plays / metrics.reach) * 100).toFixed(0)
      : null

  const metricsBlock = metrics
    ? `MÉTRICAS REALES:
- Reproducciones: ${metrics.plays?.toLocaleString('es-AR') || 0}
- Alcance: ${metrics.reach?.toLocaleString('es-AR') || 0}
- Saves: ${metrics.saves || 0}
- Likes: ${metrics.likes || 0}
- Comentarios: ${metrics.comments || 0}
- Compartidos: ${metrics.shares || 0}
- Tasa de guardado: ${savesRate ? savesRate + '%' : 'N/A'} (saves/reach)
- Engagement rate: ${engagementRate ? engagementRate + '%' : 'N/A'} (likes+saves+comments/reach)
${playsToReach ? `- Play rate: ${playsToReach}% (plays/reach)` : ''}`
    : 'Sin métricas disponibles — analizá solo contenido.'

  const publishedDate = post.published_at
    ? new Date(post.published_at).toLocaleDateString('es-AR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : 'fecha desconocida'

  const prompt = `Analizá este Reel de Instagram con sus métricas reales y dame feedback accionable y específico.

DATOS DEL REEL:
Título: ${post.title || 'Sin título'}
Formato: ${post.format}
Publicado: ${publishedDate}

${metricsBlock}

CAPTION:
${post.caption || 'Sin caption'}

${post.script ? `GUIÓN:\n${post.script}` : ''}

---

Analizá en este formato exacto:

**HOOK (0–3 segundos)**
¿Los números sugieren que paró el scroll? ¿Qué funcionó o falló en el hook?

**RETENCIÓN Y RITMO**
Basándote en plays vs reach, ¿la gente terminó el video? ¿Qué dice eso del ritmo?

**ESTRUCTURA DEL GUIÓN**
¿Tiene hook → problema → solución → CTA? ¿Qué le falta o sobra?

**LECTURA DE MÉTRICAS**
Qué métrica destaca (positiva o negativamente) y qué significa para la estrategia.

**TOP 3 MEJORAS PARA EL PRÓXIMO REEL SIMILAR**
Las 3 cosas más concretas e impactantes que cambiarías.

**PUNTUACIÓN GENERAL: X/10**
Justificá en una línea basándote en los números.`

  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  })

  const message = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 1500,
    system:
      'Sos un experto en contenido de Instagram, análisis de métricas y copywriting para Reels. Sos directo y nunca das consejos genéricos — todo lo anclas a los números reales del post. Hablás en rioplatense.',
    messages: [{ role: 'user', content: prompt }],
  })

  const analysis =
    message.content[0].type === 'text' ? message.content[0].text : ''

  return Response.json({ analysis, metrics })
}
