import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = 20
  const offset = (page - 1) * limit

  const { data, error, count } = await supabaseAdmin
    .from('competitor_posts')
    .select('*', { count: 'exact' })
    .eq('competitor_id', id)
    .order('published_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ posts: data || [], total: count || 0, page, limit })
}
