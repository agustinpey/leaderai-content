import { supabaseAdmin } from '@/lib/supabase'
import { buildIntelligenceContext, generateContentIdeas } from '@/lib/intelligence-agent'
import { randomUUID } from 'crypto'

export const maxDuration = 60

export async function POST() {
  // Registrar run
  const runId = randomUUID()
  await supabaseAdmin.from('intelligence_runs').insert({
    id: runId,
    run_type: 'manual',
    status: 'running',
  })

  try {
    const ctx = await buildIntelligenceContext()
    const ideas = await generateContentIdeas(ctx)

    const batchId = randomUUID()

    const rows = ideas.map((idea) => ({
      title: idea.title,
      pain_point: idea.pain_point,
      content_angle: idea.content_angle,
      why_now: idea.why_now || null,
      format_suggestion: idea.format_suggestion,
      topic_tag: idea.topic_tag,
      estimated_performance: idea.estimated_performance,
      hooks: idea.hooks || [],
      source: idea.source,
      status: 'nueva',
      generation_batch_id: batchId,
    }))

    const { data: inserted, error } = await supabaseAdmin
      .from('content_ideas')
      .insert(rows)
      .select('id')

    if (error) throw new Error(error.message)

    // Actualizar feedback loop: escribir actual_save_rate en ideas que ya se publicaron
    await updateIdeasFeedback()

    await supabaseAdmin
      .from('intelligence_runs')
      .update({
        status: 'completed',
        ideas_generated: inserted?.length || 0,
        winning_posts_count: ctx.winningPosts.length,
        saves_threshold: ctx.savesThreshold,
        competitors_scraped: new Set(ctx.competitorGaps.map((g) => g.username)).size,
        completed_at: new Date().toISOString(),
      })
      .eq('id', runId)

    return Response.json({
      ideas_generated: inserted?.length || 0,
      batch_id: batchId,
      message: `${inserted?.length || 0} ideas generadas`,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    await supabaseAdmin
      .from('intelligence_runs')
      .update({ status: 'failed', error_message: msg, completed_at: new Date().toISOString() })
      .eq('id', runId)

    return Response.json({ error: msg }, { status: 500 })
  }
}

async function updateIdeasFeedback() {
  const { data: ideasWithPosts } = await supabaseAdmin
    .from('content_ideas')
    .select('id, converted_to_post_id')
    .not('converted_to_post_id', 'is', null)
    .is('actual_save_rate', null)

  if (!ideasWithPosts?.length) return

  for (const idea of ideasWithPosts) {
    const { data: metrics } = await supabaseAdmin
      .from('post_metrics')
      .select('saves, reach')
      .eq('post_id', idea.converted_to_post_id!)
      .single()

    if (metrics && metrics.reach > 0) {
      const actualRate = parseFloat(((metrics.saves / metrics.reach) * 100).toFixed(2))
      await supabaseAdmin
        .from('content_ideas')
        .update({ actual_save_rate: actualRate })
        .eq('id', idea.id)
    }
  }
}
