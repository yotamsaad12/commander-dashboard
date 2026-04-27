import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  let query = supabase
    .from('guard_slots')
    .select('*, guard_positions(*), users(id, name)')
    .order('start_time')

  if (userId) query = query.eq('soldier_id', userId)
  if (from) query = query.gte('start_time', from)
  if (to) query = query.lte('start_time', to)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { position_id, soldier_id, start_time, end_time } = body

  if (!position_id || !soldier_id || !start_time || !end_time) {
    return NextResponse.json({ error: 'חסרים שדות חובה' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('guard_slots')
    .insert({ position_id, soldier_id, start_time, end_time })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const body = await req.json()
  const { id, soldier_id } = body

  if (!id || !soldier_id) return NextResponse.json({ error: 'חסרים שדות' }, { status: 400 })

  const { data, error } = await supabase
    .from('guard_slots')
    .update({ soldier_id })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const from = searchParams.get('from')
  const all = searchParams.get('all')

  if (all === '1') {
    const { error } = await supabase.from('guard_slots').delete().gte('id', '00000000-0000-0000-0000-000000000000')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  if (from) {
    const { error } = await supabase.from('guard_slots').delete().gte('start_time', from)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  if (!id) return NextResponse.json({ error: 'חסר id' }, { status: 400 })
  const { error } = await supabase.from('guard_slots').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
