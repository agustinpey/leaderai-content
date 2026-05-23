import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: Request) {
  const { idea_id } = await req.json()
  if (!idea_id) return Response.json({ error: 'idea_id requerido' }, { status: 400 })

  const { data: idea, error } = await supabaseAdmin
    .from('content_ideas')
    .select('*')
    .eq('id', idea_id)
    .single()

  if (error || !idea) return Response.json({ error: 'Idea no encontrada' }, { status: 404 })

  await supabaseAdmin
    .from('content_ideas')
    .update({ sent_to_chat_at: new Date().toISOString(), status: 'en_proceso' })
    .eq('id', idea_id)

  // Construir el prompt pre-cargado para el chat
  const chatPrompt = `Necesito un guión completo para el siguiente Reel de Instagram.

**IDEA:** ${idea.title}
**PUNTO DE DOLOR:** ${idea.pain_point}
**ÁNGULO:** ${idea.content_angle}
**FORMATO:** ${idea.format_suggestion}

**HOOKS (elegí el mejor o mejoralo):**
${(idea.hooks || []).map((h: string, i: number) => `${i + 1}. ${h}`).join('\n')}

${idea.full_brief ? `**BRIEF PREVIO:**\n${idea.full_brief}\n` : ''}
Con este contexto, escribí el guión completo listo para grabar. Incluí timing aproximado por sección, las palabras exactas a decir, y el CTA final.`

  return Response.json({ chat_prompt: chatPrompt, idea_id })
}
