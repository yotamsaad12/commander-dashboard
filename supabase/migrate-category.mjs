import pg from 'pg'

const client = new pg.Client({
  connectionString: 'postgresql://postgres:hymgoz-pexKi8-qowpog@db.xjkvfgtlwbdfbagwopll.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false },
})

await client.connect()

await client.query(`
  ALTER TABLE guard_positions
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'guard'
  CHECK (category IN ('guard', 'kitchen', 'hamal'));
`)
console.log('✓ Added category column to guard_positions')

await client.end()
console.log('Done')
