import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { generateGuardRoster } from '@/lib/guard-generator'

function parseDateParts(dateStr: string): [number, number, number] {
  const [y, m, d] = dateStr.split('-').map(Number)
  return [y, m - 1, d]
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { start_date, end_date, mission_hour } = body

  if (!start_date || !end_date) {
    return NextResponse.json({ error: 'חסרים תאריכים' }, { status: 400 })
  }

  const hour = typeof mission_hour === 'number' ? mission_hour : 12

  // Build exact UTC timestamps for mission start and end
  const [sy, sm, sd] = parseDateParts(start_date)
  const [ey, em, ed] = parseDateParts(end_date)
  const missionStart = new Date(Date.UTC(sy, sm, sd, hour, 0, 0, 0))
  const missionEnd   = new Date(Date.UTC(ey, em, ed, hour, 0, 0, 0))

  const [positionsRes, soldiersRes, constraintsRes, presenceRes] = await Promise.all([
    supabase.from('guard_positions').select('*').eq('is_active', true),
    supabase.from('users').select('*').eq('is_active', true),
    supabase.from('constraints').select('*').eq('status', 'approved'),
    supabase.from('daily_presence').select('user_id, date, is_present')
      .gte('date', start_date)
      .lte('date', end_date),
  ])

  if (positionsRes.error) return NextResponse.json({ error: positionsRes.error.message }, { status: 500 })
  if (soldiersRes.error) return NextResponse.json({ error: soldiersRes.error.message }, { status: 500 })
  if (constraintsRes.error) return NextResponse.json({ error: constraintsRes.error.message }, { status: 500 })

  // Find soldiers currently assigned to hamal in the requested period
  const hamalPositionIds = (positionsRes.data ?? [])
    .filter(p => p.category === 'hamal')
    .map(p => p.id)

  let excludedSoldierIds: string[] = []
  if (hamalPositionIds.length > 0) {
    const { data: hamalSlots } = await supabase
      .from('guard_slots')
      .select('soldier_id')
      .in('position_id', hamalPositionIds)
      .lt('start_time', missionEnd.toISOString())
      .gte('end_time', missionStart.toISOString())
    excludedSoldierIds = [...new Set(hamalSlots?.map(s => s.soldier_id) ?? [])]
  }

  const slots = generateGuardRoster(
    missionStart,
    missionEnd,
    positionsRes.data ?? [],
    soldiersRes.data ?? [],
    constraintsRes.data ?? [],
    excludedSoldierIds,
    presenceRes.data ?? []
  )

  if (slots.length === 0) {
    return NextResponse.json({ error: 'לא ניתן ליצור רשימת שמירה — אין עמדות פעילות או חיילים זמינים' }, { status: 400 })
  }

  // Delete only guard-category slots in the mission range (preserve hamal/kitchen)
  const guardPositionIds = (positionsRes.data ?? [])
    .filter(p => !p.category || p.category === 'guard')
    .map(p => p.id)

  if (guardPositionIds.length > 0) {
    await supabase.from('guard_slots').delete()
      .in('position_id', guardPositionIds)
      .gte('start_time', missionStart.toISOString())
      .lt('start_time', missionEnd.toISOString())
  }

  const { data, error } = await supabase.from('guard_slots').insert(slots).select()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ count: data.length, slots: data })
}
