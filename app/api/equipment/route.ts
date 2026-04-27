import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')

  let query = supabase
    .from('equipment')
    .select('*, users(id, name)')
    .order('created_at', { ascending: false })

  if (userId) query = query.eq('user_id', userId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { user_id, type, serial_number, notes } = body

  if (!user_id || !type) {
    return NextResponse.json({ error: 'חסרים שדות חובה' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('equipment')
    .insert({ user_id, type, serial_number: serial_number || null, notes })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const body = await req.json()
  const { id, type, serial_number, notes } = body

  if (!id) return NextResponse.json({ error: 'חסר id' }, { status: 400 })

  const { data, error } = await supabase
    .from('equipment')
    .update({ type, serial_number, notes })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'חסר id' }, { status: 400 })

  const { error } = await supabase.from('equipment').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
