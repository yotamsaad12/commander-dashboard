import { GuardPosition, User, Constraint, DailyPresence } from './types'

export interface GeneratedSlot {
  position_id: string
  soldier_id: string
  start_time: string
  end_time: string
}

const MS_HOUR = 3600 * 1000
const MS_DAY  = 24 * MS_HOUR

/** Extract "YYYY-MM-DD" from a Date using UTC components — never affected by server timezone. */
function utcDateStr(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Parse a "YYYY-MM-DD" date string as UTC midnight. */
function parseUTCDate(s: string): Date {
  return new Date(s + 'T00:00:00.000Z')
}

function isAvailable(
  soldier: User,
  slotStart: Date,
  slotEnd: Date,
  constraints: Constraint[],
  dailyPresence: DailyPresence[]
): boolean {
  // --- Approved constraint check ---
  for (const c of constraints) {
    if (c.user_id !== soldier.id || c.status !== 'approved') continue

    // Parse dates as UTC so there's no timezone shift
    const cStart = parseUTCDate(c.start_date)
    const cEnd   = new Date(c.end_date + 'T23:59:59.999Z')

    // Slot overlaps with constraint period
    if (slotStart < cEnd && slotEnd > cStart) return false

    // Rest rule: ≥1-day absence → 6h rest after returning
    const absenceDays = (cEnd.getTime() - cStart.getTime()) / MS_DAY
    if (absenceDays >= 1 && slotStart < new Date(cEnd.getTime() + 6 * MS_HOUR)) return false
  }

  // --- Per-day presence check (daily_presence table) ---
  // Walk every UTC calendar day the slot touches and look for is_present=false records.
  const slotStartDay = new Date(utcDateStr(slotStart) + 'T00:00:00.000Z')
  const slotEndDay   = new Date(utcDateStr(slotEnd)   + 'T00:00:00.000Z')

  for (let d = slotStartDay; d <= slotEndDay; d = new Date(d.getTime() + MS_DAY)) {
    const ds = utcDateStr(d)
    const rec = dailyPresence.find(p => p.user_id === soldier.id && p.date === ds)
    if (rec && !rec.is_present) return false
  }

  return true
}

interface PendingSlot {
  positionId: string
  slotStart: Date
  slotEnd: Date
  shiftDurationMs: number
  slotsPerShift: number
  pool: User[]
}

function buildPendingSlots(
  positions: GuardPosition[],
  activeMembers: User[],
  startDate: Date,
  endDate: Date
): PendingSlot[] {
  const pending: PendingSlot[] = []

  // endMs is the last valid millisecond of endDate in UTC
  const endMs = Date.UTC(
    endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate(),
    23, 59, 59, 999
  )

  for (const position of positions.filter(p => p.is_active && (!p.category || p.category === 'guard'))) {
    const shiftHours    = position.shift_duration_hours
    const slotsPerShift = position.slots_count ?? 1
    const startHour     = position.start_hour  ?? 0
    const shiftMs       = shiftHours * MS_HOUR

    // Commanders only join shifts ≤ 4 hours
    const pool = activeMembers.filter(s => s.role === 'soldier' || shiftHours <= 4)

    if (shiftHours >= 24) {
      // Long shift: one slot per period starting at startHour (UTC)
      let cur = new Date(Date.UTC(
        startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate(),
        startHour, 0, 0, 0
      ))
      while (cur.getTime() <= endMs) {
        const slotStart = new Date(cur)
        const slotEnd   = new Date(cur.getTime() + shiftMs)
        pending.push({ positionId: position.id, slotStart, slotEnd, shiftDurationMs: shiftMs, slotsPerShift, pool })
        cur = new Date(slotEnd)
      }
    } else {
      // Short shift: divide each UTC day into equal parts starting at 00:00 UTC
      const shiftsPerDay = Math.floor(24 / shiftHours)
      let dayStart = new Date(Date.UTC(
        startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()
      ))
      while (dayStart.getTime() <= endMs) {
        for (let s = 0; s < shiftsPerDay; s++) {
          const slotStart = new Date(dayStart.getTime() + s * shiftMs)
          const slotEnd   = new Date(slotStart.getTime() + shiftMs)
          if (slotStart.getTime() > endMs) break
          pending.push({ positionId: position.id, slotStart, slotEnd, shiftDurationMs: shiftMs, slotsPerShift, pool })
        }
        // Advance to next UTC day
        dayStart = new Date(Date.UTC(
          dayStart.getUTCFullYear(), dayStart.getUTCMonth(), dayStart.getUTCDate() + 1
        ))
      }
    }
  }

  // Sort ALL slots chronologically so assignments respect time order across positions
  pending.sort((a, b) => a.slotStart.getTime() - b.slotStart.getTime())
  return pending
}

export function generateGuardRoster(
  startDate: Date,
  endDate: Date,
  positions: GuardPosition[],
  soldiers: User[],
  approvedConstraints: Constraint[],
  excludedSoldierIds: string[] = [],
  dailyPresence: DailyPresence[] = []
): GeneratedSlot[] {
  const result: GeneratedSlot[] = []

  const shiftCounts:    Record<string, number> = {}
  // lastAvailableAt[id] = earliest UTC ms when soldier may start another shift
  const lastAvailableAt: Record<string, number> = {}
  soldiers.forEach(s => { shiftCounts[s.id] = 0; lastAvailableAt[s.id] = 0 })

  const activeMembers = soldiers.filter(s => s.is_active && !excludedSoldierIds.includes(s.id))
  const pendingSlots  = buildPendingSlots(positions, activeMembers, startDate, endDate)

  for (const { positionId, slotStart, slotEnd, shiftDurationMs, slotsPerShift, pool } of pendingSlots) {
    const slotStartMs = slotStart.getTime()
    const assigned    = new Set<string>()

    for (let n = 0; n < slotsPerShift; n++) {
      const candidates = pool
        .filter(s =>
          !assigned.has(s.id) &&
          slotStartMs >= lastAvailableAt[s.id] &&          // minimum rest enforced
          isAvailable(s, slotStart, slotEnd, approvedConstraints, dailyPresence)
        )
        .sort((a, b) => (shiftCounts[a.id] ?? 0) - (shiftCounts[b.id] ?? 0))

      if (candidates.length === 0) break

      const chosen = candidates[0]
      assigned.add(chosen.id)
      shiftCounts[chosen.id]++
      // 1:1 work-to-rest ratio: next available = end of this shift + same duration
      lastAvailableAt[chosen.id] = slotEnd.getTime() + shiftDurationMs
      result.push({
        position_id: positionId,
        soldier_id:  chosen.id,
        start_time:  slotStart.toISOString(),
        end_time:    slotEnd.toISOString(),
      })
    }
  }

  return result
}
