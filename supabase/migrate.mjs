import pg from 'pg'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dir = dirname(fileURLToPath(import.meta.url))

const client = new pg.Client({
  connectionString: 'postgresql://postgres:hymgoz-pexKi8-qowpog@db.xjkvfgtlwbdfbagwopll.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false },
})

await client.connect()
console.log('✓ Connected to Supabase')

const schema = readFileSync(join(__dir, 'schema.sql'), 'utf8')
const seed = readFileSync(join(__dir, 'seed.sql'), 'utf8')

try {
  console.log('Running schema...')
  await client.query(schema)
  console.log('✓ Schema created')
} catch (e) {
  if (e.message.includes('already exists')) {
    console.log('ℹ Schema already exists, skipping')
  } else {
    console.error('Schema error:', e.message)
  }
}

try {
  console.log('Running seed...')
  await client.query(seed)
  console.log('✓ Users seeded (20 members)')
} catch (e) {
  console.error('Seed error:', e.message)
}

const { rows } = await client.query('SELECT name, role FROM users ORDER BY role, name')
console.log('\nUsers in DB:')
rows.forEach(r => console.log(`  ${r.role === 'commander' ? '⭐' : '·'} ${r.name}`))

await client.end()
