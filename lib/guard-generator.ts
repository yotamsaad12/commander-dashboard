import { GuardPosition, User, Constraint } from './types'

export interface GeneratedSlot {
  position_id: string
  soldier_id: string
  start_time: string
  end_time: string
}

const MS_HOUR = 3600 * 1000

function isAvailable(soldier: User, slotStart: Date, slotEnd: Date, constraints: Constraint[]): boolean {
  for (const c of constraints) {
    if (c.user_id !== soldier.id || c.status !== 'approved') continue

    const cStart = new Date(c.start_date)
    cStart.setHours(0, 0, 0, 0)
    const cEnd = new Date(c.end_date)
    cEnd.setHours(23, 59, 59, 999)

    // Overlap with constraint period
    if (slotStart < cEnd && slotEnd > cStart) return false

    // Rule: if absence lasted ≥ 1 day, soldier rests 6h after returning
    const absenceDays = (cEnd.getTime() - cStart.getTime()) / (24 * MS_HOUR)
    if (absenceDays >= 1) {
      const restUntil = new Date(cEnd.getTime() + 6 * MS_HOUR)
      if (slotStart < restUntil) return false
    }
  }
  return true
}

export function generateGuardRoster(
  startDate: Date,
  endDate: Date,
  positions: GuardPosition[],
  soldiers: User[],
  approvedConstraints: Constraint[]
): GeneratedSlot[] {
  const slots: GeneratedSlot[] = []
  const shiftCounts: Record<string, number> = {}
  soldiers.forEach(s => { shiftCounts[s.id] = 0 })

  const activeMembers = soldiers.filter(s => s.is_active && s.is_present)

  for (const position of positions.filter(p => p.is_active)) {
    const shiftHours = position.shift_duration_hours
    const slotsPerShift = position.slots_count ?? 1
    const startHour = position.start_hour ?? 0

    // Commanders join only shifts ≤ 4 hours
    const pool = activeMembers.filter(s => s.role === 'soldier' || shiftHours <= 4)

    const endMs = new Date(endDate).setHours(23, 59, 59, 999)

    if (shiftHours >= 24) {
      // Long shift: one slot per period, starting at startHour each day
      let current = new Date(startDate)
      current.setHours(startHour, 0, 0, 0)
      // If startHour has already passed today, start from today anyway
      while (current.getTime() <= endMs) {
        const slotStart = new Date(current)
        const slotEnd = new Date(current.getTime() + shiftHours * MS_HOUR)
        if (slotStart.getTime() > endMs) break

        assignSlot(slotStart, slotEnd, position.id, pool, shiftCounts, approvedConstraints, slotsPerShift, slots)
        current = new Date(slotEnd) // next slot starts when this one ends
      }
    } else {
      // Short shift: divide each day into equal parts starting at 00:00
      const shiftsPerDay = Math.floor(24 / shiftHours)
      const current = new Date(startDate)
      current.setHours(0, 0, 0, 0)

      while (current.getTime() <= endMs) {
        for (let s = 0; s < shiftsPerDay; s++) {
          const slotStart = new Date(current)
          slotStart.setHours(s * shiftHours, 0, 0, 0)
          const slotEnd = new Date(slotStart.getTime() + shiftHours * MS_HOUR)
          if (slotStart.getTime() > endMs) break

          assignSlot(slotStart, slotEnd, position.id, pool, shiftCounts, approvedConstraints, slotsPerShift, slots)
        }
        current.setDate(current.getDate() + 1)
      }
    }
  }

  return slots
}

function assignSlot(
  slotStart: Date,
  slotEnd: Date,
  positionId: string,
  pool: User[],
  shiftCounts: Record<string, number>,
  constraints: Constraint[],
  slotsPerShift: number,
  slots: GeneratedSlot[]
) {
  const assigned = new Set<string>()

  for (let n = 0; n < slotsPerShift; n++) {
    const candidates = pool
      .filter(s => !assigned.has(s.id) && isAvailable(s, slotStart, slotEnd, constraints))
      .sort((a, b) => (shiftCounts[a.id] ?? 0) - (shiftCounts[b.id] ?? 0))

    if (candidates.length === 0) break
    const chosen = candidates[0]
    assigned.add(chosen.id)
    shiftCounts[chosen.id] = (shiftCounts[chosen.id] ?? 0) + 1
    slots.push({ position_id: positionId, soldier_id: chosen.id, start_time: slotStart.toISOString(), end_time: slotEnd.toISOString() })
  }
}
