import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')

  let query = supabase
    .from('equipment_requests')
    .select('*, users(id, name)')
    .order('created_at', { ascending: false })

  if (userId) query = query.eq('user_id', userId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { user_id, description } = body

  if (!user_id || !description) {
    return NextResponse.json({ error: 'חסרים שדות חובה' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('equipment_requests')
    .insert({ user_id, description })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { id, status } = body

  if (!id || !status) return NextResponse.json({ error: 'חסרים שדות' }, { status: 400 })

  const { data, error } = await supabase
    .from('equipment_requests')
    .update({ status })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
