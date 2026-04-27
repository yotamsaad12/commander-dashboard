import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://xjkvfgtlwbdfbagwopll.supabase.co',
  'sb_publishable_ND5IMZWPnVSN-yoyGigM0Q_Dgkz-2mP'
)

const { data, error } = await supabase.from('users').select('name, role').order('name')
if (error) {
  console.error('❌ Error:', error.message)
} else {
  console.log(`✓ Connected via Supabase JS — ${data.length} users found`)
  data.forEach(u => console.log(`  ${u.role === 'commander' ? '⭐' : '·'} ${u.name}`))
}
