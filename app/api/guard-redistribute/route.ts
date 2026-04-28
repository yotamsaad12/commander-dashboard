import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

function isAvailable(
  soldierId: string,
  slotStart: Date,
  slotEnd: Date,
  constraints: { user_id: string; start_date: string; end_date: string; status: string }[]
): boolean {
  const MS_HOUR = 3600 * 1000
  for (const c of constraints) {
    if (c.user_id !== soldierId || c.status !== 'approved') continue
    const cStart = new Date(c.start_date); cStart.setHours(0, 0, 0, 0)
    const cEnd = new Date(c.end_date); cEnd.setHours(23, 59, 59, 999)
    if (slotStart < cEnd && slotEnd > cStart) return false
    const absenceDays = (cEnd.getTime() - cStart.getTime()) / (24 * MS_HOUR)
    if (absenceDays >= 1 && slotStart < new Date(cEnd.getTime() + 6 * MS_HOUR)) return false
  }
  return true
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { soldier_id } = body
  if (!soldier_id) return NextResponse.json({ error: 'חסר soldier_id' }, { status: 400 })

  const now = new Date().toISOString()

  // Hamal position IDs
  const { data: hamalPositions } = await supabase
    .from('guard_positions')
    .select('id')
    .eq('category', 'hamal')
    .eq('is_active', true)
  const hamalPositionIds = hamalPositions?.map(p => p.id) ?? []

  // Get soldier's future guard slots (excluding hamal)
  let slotsQuery = supabase
    .from('guard_slots')
    .select('*')
    .eq('soldier_id', soldier_id)
    .gte('start_time', now)
  const { data: futureSlots } = await slotsQuery
  const guardSlots = (futureSlots ?? []).filter(s => !hamalPositionIds.includes(s.position_id))

  if (guardSlots.length === 0) return NextResponse.json({ redistributed: 0 })

  // Get all active soldiers, constraints, and current hamal assignments
  const [soldiersRes, constraintsRes, hamalSlotsRes] = await Promise.all([
    supabase.from('users').select('id, name, role').eq('is_active', true),
    supabase.from('constraints').select('*').eq('status', 'approved'),
    hamalPositionIds.length > 0
      ? supabase.from('guard_slots').select('soldier_id').in('position_id', hamalPositionIds).gte('end_time', now)
      : Promise.resolve({ data: [] }),
  ])

  const hamalSoldierIds = new Set((hamalSlotsRes.data ?? []).map((s: { soldier_id: string }) => s.soldier_id))
  const pool = (soldiersRes.data ?? []).filter(
    (s: { id: string }) => s.id !== soldier_id && !hamalSoldierIds.has(s.id)
  )

  // Count existing future shifts per pool member
  const { data: futureWeekSlots } = await supabase
    .from('guard_slots')
    .select('soldier_id')
    .gte('start_time', now)
    .neq('soldier_id', soldier_id)

  const shiftCounts: Record<string, number> = {}
  pool.forEach((s: { id: string }) => { shiftCounts[s.id] = 0 })
  ;(futureWeekSlots ?? []).forEach((s: { soldier_id: string }) => {
    if (shiftCounts[s.soldier_id] !== undefined) shiftCounts[s.soldier_id]++
  })

  // Delete soldier's future guard slots
  const slotIds = guardSlots.map((s: { id: string }) => s.id)
  await supabase.from('guard_slots').delete().in('id', slotIds)

  // Redistribute each slot to the least-loaded available soldier
  const constraints = constraintsRes.data ?? []
  const newSlots: { position_id: string; soldier_id: string; start_time: string; end_time: string }[] = []

  for (const slot of guardSlots) {
    const slotStart = new Date(slot.start_time)
    const slotEnd = new Date(slot.end_time)

    const available = pool
      .filter((s: { id: string }) => isAvailable(s.id, slotStart, slotEnd, constraints))
      .sort((a: { id: string }, b: { id: string }) => (shiftCounts[a.id] ?? 0) - (shiftCounts[b.id] ?? 0))

    if (available.length === 0) continue
    const chosen = available[0] as { id: string }
    shiftCounts[chosen.id] = (shiftCounts[chosen.id] ?? 0) + 1
    newSlots.push({ position_id: slot.position_id, soldier_id: chosen.id, start_time: slot.start_time, end_time: slot.end_time })
  }

  if (newSlots.length > 0) {
    await supabase.from('guard_slots').insert(newSlots)
  }

  return NextResponse.json({ redistributed: newSlots.length, total: guardSlots.length })
}
