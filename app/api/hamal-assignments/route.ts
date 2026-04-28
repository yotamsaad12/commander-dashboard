import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

async function getOrCreateHamalPosition() {
  const { data: existing } = await supabase
    .from('guard_positions')
    .select('id')
    .eq('category', 'hamal')
    .eq('is_active', true)
    .limit(1)
    .single()

  if (existing) return existing.id

  const { data: created } = await supabase
    .from('guard_positions')
    .insert({ name: 'חמ"ל', shift_duration_hours: 24, slots_count: 1, start_hour: 0, category: 'hamal' })
    .select('id')
    .single()

  return created?.id ?? null
}

export async function GET() {
  const { data: hamalPositions } = await supabase
    .from('guard_positions')
    .select('id')
    .eq('category', 'hamal')
    .eq('is_active', true)

  const positionIds = hamalPositions?.map(p => p.id) ?? []
  if (positionIds.length === 0) return NextResponse.json([])

  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('guard_slots')
    .select('*, users(id, name)')
    .in('position_id', positionIds)
    .gte('end_time', now)
    .order('start_time')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { soldier_id, start_date, end_date } = body

  if (!soldier_id || !start_date || !end_date) {
    return NextResponse.json({ error: 'חסרים שדות חובה' }, { status: 400 })
  }

  const positionId = await getOrCreateHamalPosition()
  if (!positionId) return NextResponse.json({ error: 'שגיאה ביצירת עמדת חמ"ל' }, { status: 500 })

  const startTime = new Date(start_date)
  startTime.setHours(0, 0, 0, 0)
  const endTime = new Date(end_date)
  endTime.setHours(23, 59, 59, 999)

  const { data, error } = await supabase
    .from('guard_slots')
    .insert({ position_id: positionId, soldier_id, start_time: startTime.toISOString(), end_time: endTime.toISOString() })
    .select('*, users(id, name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'חסר id' }, { status: 400 })

  const { error } = await supabase.from('guard_slots').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
