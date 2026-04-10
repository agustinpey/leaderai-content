import Anthropic from '@anthropic-ai/sdk'
import { buildContentContext, formatContextForClaude } from '@/lib/context-builder'
import { readFileSync } from 'fs'
import { join } from 'path'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

function getSystemPrompt(contextStr: string): string {
  // Lee el CLAUDE.md de posicionamiento de contenido
  let contentRules = ''
  try {
    contentRules = readFileSync(join(process.cwd(), 'CLAUDE.md'), 'utf-8')
  } catch {
    contentRules = ''
  }

  return `Sos el asistente de contenido personal de Agustín Pey, fundador de LeaderAI.

Tu función es ayudarlo a crear contenido para Instagram que genere autoridad, atraiga leads calificados y convierta seguidores en clientes de LeaderAI.

${contentRules ? `## REGLAS DE CONTENIDO Y POSICIONAMIENTO\n${contentRules}\n` : ''}

## CONTEXTO ACTUAL DE SU CUENTA
${contextStr}

## CÓMO TRABAJÁS

**Al generar un guión de Reel:**
- Empezás con el hook (primeras 3 segundos — tiene que detener el scroll)
- Seguís con el problema que el ICP reconoce
- Desarrollás la solución/insight
- Cerrás con CTA claro (guardar, comentar, DM)
- Formato: máximo 60-90 segundos de habla (≈ 150-200 palabras)

**Al generar un carrusel:**
- Slide 1: Hook fuerte (pregunta o promesa)
- Slides 2-6: Desarrollo del contenido
- Último slide: CTA
- Cada slide: máximo 2-3 líneas

**Reglas siempre:**
- Hablás de vos a vos — tono directo, sin ser genérico
- No usás frases de motivación vacía
- Siempre hay un solo CTA por pieza
- Cuando proponés un hook, ofrecés 3 opciones para que Agustín elija
- Si te piden analizar qué funcionó, mirás las métricas del contexto y sacás patrones concretos

Respondés en español rioplatense, como Agustín habla.`
}

export async function POST(req: Request) {
  const { messages } = await req.json()

  // Construir contexto en cada request (refleja el estado real de la cuenta)
  const ctx = await buildContentContext()
  const contextStr = formatContextForClaude(ctx)
  const systemPrompt = getSystemPrompt(contextStr)

  const stream = await anthropic.messages.stream({
    model: 'claude-opus-4-6',
    max_tokens: 2048,
    system: systemPrompt,
    messages: messages.map((m: { role: string; content: string }) => ({
      role: m.role,
      content: m.content,
    })),
  })

  const readableStream = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (
          chunk.type === 'content_block_delta' &&
          chunk.delta.type === 'text_delta'
        ) {
          controller.enqueue(new TextEncoder().encode(chunk.delta.text))
        }
      }
      controller.close()
    },
  })

  return new Response(readableStream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
    },
  })
}
