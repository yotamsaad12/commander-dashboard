export type UserRole = 'soldier' | 'commander'
export type RequestStatus = 'pending' | 'approved' | 'rejected'

export interface User {
  id: string
  name: string
  role: UserRole
  is_active: boolean
  is_present: boolean
  created_at: string
}

export interface Equipment {
  id: string
  user_id: string
  type: string
  serial_number: string
  notes: string | null
  created_at: string
  users?: Pick<User, 'id' | 'name'>
}

export interface EquipmentRequest {
  id: string
  user_id: string
  description: string
  status: RequestStatus
  created_at: string
  users?: Pick<User, 'id' | 'name'>
}

export interface Constraint {
  id: string
  user_id: string
  start_date: string
  end_date: string
  reason: string
  status: RequestStatus
  commander_note: string | null
  created_at: string
  users?: Pick<User, 'id' | 'name'>
}

export interface GuardPosition {
  id: string
  name: string
  shift_duration_hours: number
  slots_count: number
  start_hour: number
  is_active: boolean
}

export interface GuardSlot {
  id: string
  position_id: string
  soldier_id: string
  start_time: string
  end_time: string
  created_at: string
  guard_positions?: GuardPosition
  users?: Pick<User, 'id' | 'name'>
}

export interface SwapRequest {
  id: string
  requester_id: string
  target_id: string
  slot_id: string
  status: RequestStatus
  commander_note: string | null
  created_at: string
  requester?: Pick<User, 'id' | 'name'>
  target?: Pick<User, 'id' | 'name'>
  guard_slots?: GuardSlot & {
    guard_positions?: GuardPosition
  }
}
