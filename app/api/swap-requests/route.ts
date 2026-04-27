import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')
  const all = searchParams.get('all')

  let query = supabase
    .from('swap_requests')
    .select(`
      *,
      requester:requester_id(id, name),
      target:target_id(id, name),
      guard_slots(*, guard_positions(*), users(id, name))
    `)
    .order('created_at', { ascending: false })

  if (userId && !all) {
    query = query.or(`requester_id.eq.${userId},target_id.eq.${userId}`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { requester_id, target_id, slot_id } = body

  if (!requester_id || !target_id || !slot_id) {
    return NextResponse.json({ error: 'חסרים שדות חובה' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('swap_requests')
    .insert({ requester_id, target_id, slot_id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { id, status, commander_note } = body

  if (!id || !status) return NextResponse.json({ error: 'חסרים שדות' }, { status: 400 })

  const { data: swap, error: fetchError } = await supabase
    .from('swap_requests')
    .select('*, guard_slots(*)')
    .eq('id', id)
    .single()

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })

  const { error } = await supabase
    .from('swap_requests')
    .update({ status, commander_note })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (status === 'approved' && swap?.guard_slots) {
    await supabase
      .from('guard_slots')
      .update({ soldier_id: swap.target_id })
      .eq('id', swap.slot_id)
  }

  return NextResponse.json({ success: true })
}
