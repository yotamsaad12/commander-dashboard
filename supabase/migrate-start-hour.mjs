import pg from 'pg'

const client = new pg.Client({
  connectionString: 'postgresql://postgres:hymgoz-pexKi8-qowpog@db.xjkvfgtlwbdfbagwopll.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false },
})
await client.connect()

await client.query(`ALTER TABLE guard_positions ADD COLUMN IF NOT EXISTS start_hour INT NOT NULL DEFAULT 0;`)
console.log('✓ Added start_hour to guard_positions')

await client.end()
