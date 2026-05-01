import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('posts')
    .select(`
      id, title, caption, script, format, status,
      published_at, instagram_post_id, thumbnail_url, tags,
      metrics:post_metrics(id, likes, saves, reach, comments, shares, plays, collected_at)
    `)
    .not('instagram_post_id', 'is', null)
    .eq('status', 'publicado')
    .order('published_at', { ascending: false })
    .limit(50)

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  const posts = (data || []).map((p: Record<string, unknown>) => ({
    ...p,
    metrics: Array.isArray(p.metrics) ? (p.metrics[0] || null) : p.metrics,
  }))

  return Response.json({ posts })
}
