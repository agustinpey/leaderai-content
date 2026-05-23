import { supabaseAdmin } from '@/lib/supabase'
import Anthropic from '@anthropic-ai/sdk'
import { readFileSync } from 'fs'
import { join } from 'path'
import { NextRequest } from 'next/server'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const { data: idea, error } = await supabaseAdmin
    .from('content_ideas')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !idea) {
    return Response.json({ error: 'Idea no encontrada' }, { status: 404 })
  }

  // Si ya tiene brief, devolverlo directo
  if (idea.full_brief) {
    return Response.json({ brief: idea.full_brief, cached: true })
  }

  let claudeMd = ''
  try {
    claudeMd = readFileSync(join(process.cwd(), 'CLAUDE.md'), 'utf-8')
  } catch {}

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const prompt = `Expandí esta idea de contenido en un brief completo listo para grabar.

IDEA:
Título: ${idea.title}
Punto de dolor: ${idea.pain_point}
Ángulo: ${idea.content_angle}
${idea.why_now ? `Por qué ahora: ${idea.why_now}` : ''}
Formato: ${idea.format_suggestion}
Topic: ${idea.topic_tag}

HOOKS PRE-GENERADOS (elegir el mejor o mejorarlos):
${(idea.hooks || []).map((h: string, i: number) => `${i + 1}. ${h}`).join('\n')}

REGLAS DE MARCA (de CLAUDE.md):
${claudeMd.slice(0, 1500)}

---

Creá el brief en este formato exacto:

## HOOK FINAL
[El mejor hook o versión mejorada, max 2 líneas]

## DESARROLLO (3-75 segundos)
[3-4 puntos del desarrollo del video. Cada punto: una idea central + cómo explicarla. Específico, no genérico.]

## CIERRE + CTA
[El único CTA del video: guardar/comentar con una palabra/DM + la última frase de cierre]

## PARA CARRUSEL (si aplica)
[Slide 1: hook | Slide 2-N: puntos | Slide final: CTA]

## NOTAS DE PRODUCCIÓN
[Recomendaciones específicas: on-camera / pantalla / ejemplos a mostrar / demo / etc]`

  const message = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  })

  const brief = (message.content[0] as any).text

  await supabaseAdmin
    .from('content_ideas')
    .update({ full_brief: brief, brief_generated_at: new Date().toISOString() })
    .eq('id', id)

  return Response.json({ brief, cached: false })
}
