import Anthropic from '@anthropic-ai/sdk'
import { NextRequest } from 'next/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

/**
 * POST /api/analyze-video
 * Recibe un video (base64 o URL pública) y lo analiza con Claude.
 * Devuelve feedback sobre hook, edición, guión y retención.
 */
export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('video') as File | null
  const title = formData.get('title') as string || 'sin título'
  const script = formData.get('script') as string || ''

  if (!file) {
    return Response.json({ error: 'Video requerido' }, { status: 400 })
  }

  // Límite 20MB
  if (file.size > 20 * 1024 * 1024) {
    return Response.json({ error: 'El video no puede superar 20MB' }, { status: 400 })
  }

  const bytes = await file.arrayBuffer()
  const base64 = Buffer.from(bytes).toString('base64')
  const mediaType = (file.type || 'video/mp4') as 'video/mp4' | 'video/webm' | 'video/quicktime'

  const systemPrompt = `Sos un experto en contenido de Instagram, edición de video y copywriting para Reels.
Tu trabajo es analizar videos de Agustín Pey (@agustin.peyy), fundador de LeaderAI, y darle feedback concreto y accionable para mejorar sus próximos Reels.

Analizás con ojo crítico pero constructivo — como un director creativo que conoce el algoritmo de Instagram y sabe qué retiene y qué pierde audiencia.`

  const userPrompt = `Analizá este Reel${title !== 'sin título' ? ` titulado "${title}"` : ''}.
${script ? `\nGuión usado:\n${script}\n` : ''}

Dame feedback estructurado en estas categorías:

**1. HOOK (primeros 3 segundos)**
- ¿Para el scroll? ¿Por qué sí o por qué no?
- Qué cambiarías específicamente

**2. RITMO DE EDICIÓN**
- Velocidad de cortes
- Dónde pierde energía
- Qué ajustes concretos haría

**3. ENTREGA Y PRESENCIA**
- Energía en cámara
- Tono de voz, contacto visual
- Qué mejorar

**4. ESTRUCTURA DEL GUIÓN**
- ¿El problema/solución está claro?
- ¿El CTA final es efectivo?
- Qué reescribirías

**5. RETENCIÓN ESTIMADA**
- En qué segundo probablemente se van la mayoría
- Por qué
- Cómo evitarlo

**6. PUNTUACIÓN** (1-10 en cada categoría) y nota final

Sé directo y específico — nada genérico.`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64,
              },
            } as any,
            {
              type: 'text',
              text: userPrompt,
            },
          ],
        },
      ],
    })

    const analysis = (message.content[0] as any).text
    return Response.json({ analysis })
  } catch (err: any) {
    // Claude no soporta video directo — fallback con instrucciones al usuario
    if (err?.status === 400 || err?.message?.includes('media')) {
      return Response.json({
        error: 'Claude no puede procesar este formato de video directamente. Usá el chat para pegar el guión y pedí feedback sobre él.',
        fallback: true,
      }, { status: 400 })
    }
    return Response.json({ error: err?.message || 'Error al analizar' }, { status: 500 })
  }
}
