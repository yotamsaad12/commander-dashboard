-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Types
CREATE TYPE user_role AS ENUM ('soldier', 'commander');
CREATE TYPE request_status AS ENUM ('pending', 'approved', 'rejected');

-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'soldier',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Equipment assigned to soldiers
CREATE TABLE equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  serial_number TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Soldier requests for missing equipment
CREATE TABLE equipment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  status request_status DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Constraint (leave) requests
CREATE TABLE constraints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT NOT NULL,
  status request_status DEFAULT 'pending',
  commander_note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Guard positions
CREATE TABLE guard_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  shift_duration_hours INT NOT NULL DEFAULT 4,
  is_active BOOLEAN DEFAULT true
);

-- Guard duty slots
CREATE TABLE guard_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id UUID REFERENCES guard_positions(id) ON DELETE CASCADE,
  soldier_id UUID REFERENCES users(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Swap requests
CREATE TABLE swap_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID REFERENCES users(id) ON DELETE CASCADE,
  target_id UUID REFERENCES users(id) ON DELETE CASCADE,
  slot_id UUID REFERENCES guard_slots(id) ON DELETE CASCADE,
  status request_status DEFAULT 'pending',
  commander_note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Disable Row Level Security for simplicity (internal tool, no auth)
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE equipment DISABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE constraints DISABLE ROW LEVEL SECURITY;
ALTER TABLE guard_positions DISABLE ROW LEVEL SECURITY;
ALTER TABLE guard_slots DISABLE ROW LEVEL SECURITY;
ALTER TABLE swap_requests DISABLE ROW LEVEL SECURITY;
