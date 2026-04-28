import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

async function getOrCreateKitchenPosition(meal: string) {
  const name = `מטבח — ${meal}`
  const { data: existing } = await supabase
    .from('guard_positions')
    .select('id')
    .eq('category', 'kitchen')
    .eq('name', name)
    .eq('is_active', true)
    .limit(1)
    .single()

  if (existing) return existing.id

  const { data: created } = await supabase
    .from('guard_positions')
    .insert({ name, shift_duration_hours: 4, slots_count: 1, start_hour: 0, category: 'kitchen' })
    .select('id')
    .single()

  return created?.id ?? null
}

// GET ?from=&to= — return kitchen slots in range
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const { data: kitchenPositions } = await supabase
    .from('guard_positions')
    .select('id')
    .eq('category', 'kitchen')
    .eq('is_active', true)

  const positionIds = kitchenPositions?.map(p => p.id) ?? []
  if (positionIds.length === 0) return NextResponse.json([])

  let query = supabase
    .from('guard_slots')
    .select('*, guard_positions(name, category), users(id, name)')
    .in('position_id', positionIds)
    .order('start_time')

  if (from) query = query.gte('start_time', from)
  if (to) query = query.lte('start_time', to)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { soldier_id, date, meal } = body

  if (!soldier_id || !date || !meal) {
    return NextResponse.json({ error: 'חסרים שדות חובה' }, { status: 400 })
  }

  const positionId = await getOrCreateKitchenPosition(meal)
  if (!positionId) return NextResponse.json({ error: 'שגיאה ביצירת עמדת מטבח' }, { status: 500 })

  const d = new Date(date)
  const MEAL_HOURS: Record<string, [number, number]> = {
    'בוקר': [6, 9],
    'צהריים': [11, 14],
    'ערב': [17, 20],
  }
  const [startH, endH] = MEAL_HOURS[meal] ?? [8, 12]
  const start = new Date(d); start.setHours(startH, 0, 0, 0)
  const end = new Date(d); end.setHours(endH, 0, 0, 0)

  const { data, error } = await supabase
    .from('guard_slots')
    .insert({ position_id: positionId, soldier_id, start_time: start.toISOString(), end_time: end.toISOString() })
    .select('*, guard_positions(name, category), users(id, name)')
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
