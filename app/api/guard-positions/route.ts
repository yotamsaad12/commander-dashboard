import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  const { data, error } = await supabase
    .from('guard_positions')
    .select('*')
    .eq('is_active', true)
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, shift_duration_hours, slots_count, start_hour } = body

  if (!name || !shift_duration_hours) {
    return NextResponse.json({ error: 'חסרים שדות חובה' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('guard_positions')
    .insert({ name, shift_duration_hours, slots_count: slots_count ?? 1, start_hour: start_hour ?? 0 })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'חסר id' }, { status: 400 })

  const { error } = await supabase.from('guard_positions').update({ is_active: false }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
