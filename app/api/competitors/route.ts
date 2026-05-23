import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('competitors')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ competitors: data || [] })
}

export async function POST(req: NextRequest) {
  const { username, niche, notes } = await req.json()
  if (!username) return Response.json({ error: 'username requerido' }, { status: 400 })

  const clean = username.replace('@', '').trim().toLowerCase()

  const { data, error } = await supabaseAdmin
    .from('competitors')
    .insert({ username: clean, niche: niche || 'ai_sales', notes: notes || null })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ competitor: data })
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return Response.json({ error: 'id requerido' }, { status: 400 })

  const { error } = await supabaseAdmin.from('competitors').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ deleted: true })
}
