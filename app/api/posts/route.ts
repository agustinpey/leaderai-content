import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const month = searchParams.get('month') // formato: YYYY-MM

  let query = supabaseAdmin
    .from('posts')
    .select('*, metrics:post_metrics(*)')
    .order('scheduled_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (status) {
    query = query.eq('status', status)
  }

  if (month) {
    const [year, m] = month.split('-').map(Number)
    const start = new Date(year, m - 1, 1).toISOString()
    const end = new Date(year, m, 0, 23, 59, 59).toISOString()
    query = query.or(`scheduled_at.gte.${start},created_at.gte.${start}`)
    query = query.or(`scheduled_at.lte.${end},created_at.lte.${end}`)
  }

  const { data, error } = await query

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json()

  const { data, error } = await supabaseAdmin
    .from('posts')
    .insert({
      title: body.title,
      caption: body.caption,
      script: body.script,
      hooks: body.hooks,
      format: body.format || 'reel',
      status: body.status || 'borrador',
      scheduled_at: body.scheduled_at,
      tags: body.tags,
    })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Si tiene scheduled_at, crear notificación automática
  if (body.scheduled_at) {
    await supabaseAdmin.from('notifications').insert({
      post_id: data.id,
      message: `Es hora de publicar: "${data.title}"`,
      type: 'publicar_ahora',
    })
  }

  return Response.json(data, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { id, ...updates } = body

  if (!id) return Response.json({ error: 'id requerido' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('posts')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (!id) return Response.json({ error: 'id requerido' }, { status: 400 })

  const { error } = await supabaseAdmin.from('posts').delete().eq('id', id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
