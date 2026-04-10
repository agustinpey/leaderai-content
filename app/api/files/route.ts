import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')
  const postId = searchParams.get('post_id')

  let query = supabaseAdmin
    .from('files')
    .select('*, post:posts(title, format, status)')
    .order('created_at', { ascending: false })

  if (type) query = query.eq('type', type)
  if (postId) query = query.eq('post_id', postId)

  const { data, error } = await query

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File
  const postId = formData.get('post_id') as string | null
  const fileType = formData.get('type') as 'video' | 'image' | 'document'

  if (!file) return Response.json({ error: 'Archivo requerido' }, { status: 400 })

  const ext = file.name.split('.').pop()
  const storagePath = `uploads/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  // Subir a Supabase Storage
  const bytes = await file.arrayBuffer()
  const { error: uploadError } = await supabaseAdmin.storage
    .from('content')
    .upload(storagePath, bytes, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) return Response.json({ error: uploadError.message }, { status: 500 })

  const { data: urlData } = supabaseAdmin.storage.from('content').getPublicUrl(storagePath)

  const { data, error } = await supabaseAdmin
    .from('files')
    .insert({
      name: file.name,
      type: fileType || (file.type.startsWith('video') ? 'video' : file.type.startsWith('image') ? 'image' : 'document'),
      url: urlData.publicUrl,
      storage_path: storagePath,
      size_bytes: file.size,
      post_id: postId || null,
    })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (!id) return Response.json({ error: 'id requerido' }, { status: 400 })

  // Obtener el storage_path antes de borrar
  const { data: file } = await supabaseAdmin
    .from('files')
    .select('storage_path')
    .eq('id', id)
    .single()

  if (file) {
    await supabaseAdmin.storage.from('content').remove([file.storage_path])
  }

  const { error } = await supabaseAdmin.from('files').delete().eq('id', id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
