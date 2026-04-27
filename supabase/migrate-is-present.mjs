import pg from 'pg'

const client = new pg.Client({
  connectionString: 'postgresql://postgres:hymgoz-pexKi8-qowpog@db.xjkvfgtlwbdfbagwopll.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false },
})

await client.connect()
await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_present BOOLEAN NOT NULL DEFAULT true;`)
console.log('✓ Added is_present to users')
await client.end()
