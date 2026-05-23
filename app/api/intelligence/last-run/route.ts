import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const { data } = await supabaseAdmin
    .from('intelligence_runs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(1)
    .single()

  return Response.json({ run: data || null })
}
