import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')
  const status = searchParams.get('status')

  let query = supabase
    .from('constraints')
    .select('*, users(id, name)')
    .order('created_at', { ascending: false })

  if (userId) query = query.eq('user_id', userId)
  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { user_id, start_date, end_date, reason } = body

  if (!user_id || !start_date || !end_date || !reason) {
    return NextResponse.json({ error: 'חסרים שדות חובה' }, { status: 400 })
  }

  // Rule: constraints must be submitted at least 7 days in advance
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const minDate = new Date(today.getTime() + 7 * 24 * 3600 * 1000)
  const reqStart = new Date(start_date)
  if (reqStart < minDate) {
    return NextResponse.json(
      { error: 'אילוץ חייב להיות מוגש לפחות שבוע מראש', tooLate: true },
      { status: 422 }
    )
  }

  const { data, error } = await supabase
    .from('constraints')
    .insert({ user_id, start_date, end_date, reason })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { id, status, commander_note } = body

  if (!id || !status) return NextResponse.json({ error: 'חסרים שדות' }, { status: 400 })

  const { data, error } = await supabase
    .from('constraints')
    .update({ status, commander_note })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
