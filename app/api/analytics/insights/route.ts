import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('weekly_insights')
    .select('*')
    .order('week_start', { ascending: false })
    .limit(12)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
