import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('content_ideas')
    .select('*')
    .neq('status', 'descartada')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ideas: data || [] })
}

export async function PATCH(req: NextRequest) {
  const { id, status, converted_to_post_id } = await req.json()
  if (!id) return Response.json({ error: 'id requerido' }, { status: 400 })

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (status) updates.status = status
  if (converted_to_post_id !== undefined) updates.converted_to_post_id = converted_to_post_id

  const { data, error } = await supabaseAdmin
    .from('content_ideas')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ idea: data })
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return Response.json({ error: 'id requerido' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('content_ideas')
    .update({ status: 'descartada' })
    .eq('id', id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ deleted: true })
}
