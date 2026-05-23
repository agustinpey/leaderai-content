import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('scripts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ scripts: data || [] })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { title, content, hook, format, topic, source_idea_id } = body

  if (!title || !content) {
    return Response.json({ error: 'title y content requeridos' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('scripts')
    .insert({
      title,
      content,
      hook: hook || null,
      format: format || 'reel',
      topic: topic || null,
      status: 'pendiente',
      source_idea_id: source_idea_id || null,
    })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ script: data })
}

export async function PATCH(req: NextRequest) {
  const { id, status, title, content } = await req.json()
  if (!id) return Response.json({ error: 'id requerido' }, { status: 400 })

  const updates: Record<string, unknown> = {}
  if (status) updates.status = status
  if (title) updates.title = title
  if (content !== undefined) updates.content = content

  const { data, error } = await supabaseAdmin
    .from('scripts')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ script: data })
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return Response.json({ error: 'id requerido' }, { status: 400 })

  const { error } = await supabaseAdmin.from('scripts').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ deleted: true })
}
