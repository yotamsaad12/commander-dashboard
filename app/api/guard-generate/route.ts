import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { generateGuardRoster } from '@/lib/guard-generator'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { start_date, end_date } = body

  if (!start_date || !end_date) {
    return NextResponse.json({ error: 'חסרים תאריכים' }, { status: 400 })
  }

  const [positionsRes, soldiersRes, constraintsRes] = await Promise.all([
    supabase.from('guard_positions').select('*').eq('is_active', true),
    supabase.from('users').select('*').eq('is_active', true),
    supabase.from('constraints').select('*').eq('status', 'approved'),
  ])

  if (positionsRes.error) return NextResponse.json({ error: positionsRes.error.message }, { status: 500 })
  if (soldiersRes.error) return NextResponse.json({ error: soldiersRes.error.message }, { status: 500 })
  if (constraintsRes.error) return NextResponse.json({ error: constraintsRes.error.message }, { status: 500 })

  const slots = generateGuardRoster(
    new Date(start_date),
    new Date(end_date),
    positionsRes.data ?? [],
    soldiersRes.data ?? [],
    constraintsRes.data ?? []
  )

  if (slots.length === 0) {
    return NextResponse.json({ error: 'לא ניתן ליצור רשימת שמירה — אין עמדות פעילות או חיילים זמינים' }, { status: 400 })
  }

  // Delete existing slots in the range before inserting new ones
  await supabase.from('guard_slots').delete().gte('start_time', new Date(start_date).toISOString()).lte('start_time', new Date(end_date + 'T23:59:59').toISOString())

  const { data, error } = await supabase.from('guard_slots').insert(slots).select()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ count: data.length, slots: data })
}
