import pg from 'pg'

const client = new pg.Client({
  connectionString: 'postgresql://postgres:hymgoz-pexKi8-qowpog@db.xjkvfgtlwbdfbagwopll.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false },
})

await client.connect()

// Add slots_count column to guard_positions
await client.query(`
  ALTER TABLE guard_positions
  ADD COLUMN IF NOT EXISTS slots_count INT NOT NULL DEFAULT 1;
`)
console.log('✓ Added slots_count to guard_positions')

// Clear existing guard data
await client.query('DELETE FROM swap_requests')
await client.query('DELETE FROM guard_slots')
await client.query('DELETE FROM guard_positions')
console.log('✓ Cleared existing guard data')

await client.end()
console.log('Done')
