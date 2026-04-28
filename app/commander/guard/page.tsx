'use client'

import { useState, useEffect } from 'react'
import { GuardSlot, GuardPosition, User, SwapRequest } from '@/lib/types'
import StatusBadge from '@/components/StatusBadge'

function fmt(iso: string, mode: 'date' | 'time' | 'both' = 'both') {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  const date = `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`
  const time = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
  if (mode === 'date') return date
  if (mode === 'time') return time
  return `${date} ${time}`
}

function durationLabel(hours: number) {
  if (hours < 24) return `${hours} שעות`
  const days = hours / 24
  return days === 1 ? 'יום אחד' : `${days} ימים`
}

const DURATION_OPTIONS = [2, 3, 4, 6, 8, 12, 24, 48, 72]
const MEALS = ['בוקר', 'צהריים', 'ערב']

const CATEGORY_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  guard:   { bg: '#e3f2fd', text: '#1565c0', label: 'שמירה' },
  kitchen: { bg: '#fff3e0', text: '#bf360c', label: 'מטבח' },
  hamal:   { bg: '#fce4ec', text: '#880e4f', label: 'חמ"ל' },
}

const POSITION_COLORS = [
  { bg: '#e3f2fd', text: '#1565c0', dot: '#42a5f5' },
  { bg: '#fce4ec', text: '#880e4f', dot: '#f06292' },
  { bg: '#fff3e0', text: '#bf360c', dot: '#ffa726' },
  { bg: '#f3e5f5', text: '#6a1b9a', dot: '#ba68c8' },
  { bg: '#e0f2f1', text: '#004d40', dot: '#4db6ac' },
  { bg: '#f9fbe7', text: '#33691e', dot: '#aed581' },
  { bg: '#fbe9e7', text: '#bf360c', dot: '#ff7043' },
  { bg: '#ede7f6', text: '#4527a0', dot: '#9575cd' },
]

interface HamalSlot {
  id: string
  soldier_id: string
  start_time: string
  end_time: string
  users?: { id: string; name: string }
}

export default function CommanderGuardPage() {
  const [slots, setSlots] = useState<GuardSlot[]>([])
  const [positions, setPositions] = useState<GuardPosition[]>([])
  const [soldiers, setSoldiers] = useState<User[]>([])
  const [swaps, setSwaps] = useState<SwapRequest[]>([])
  const [hamalSlots, setHamalSlots] = useState<HamalSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'roster' | 'positions' | 'hamal' | 'swaps'>('roster')

  const [genForm, setGenForm] = useState({ start_date: '', end_date: '', mission_hour: 12 })
  const [generating, setGenerating] = useState(false)
  const [genMsg, setGenMsg] = useState('')
  const [deleting, setDeleting] = useState(false)

  const [posForm, setPosForm] = useState({ name: '', shift_duration_hours: '4', slots_count: '1', start_hour: '0', category: 'guard' })
  const [addingPos, setAddingPos] = useState(false)

  const [editSlot, setEditSlot] = useState<GuardSlot | null>(null)
  const [editSoldierId, setEditSoldierId] = useState('')

  // Hamal modal
  const [showHamalModal, setShowHamalModal] = useState(false)
  const [hamalForm, setHamalForm] = useState({ soldier_id: '', start_date: '', end_date: '' })
  const [savingHamal, setSavingHamal] = useState(false)

  // Kitchen modal
  const [showKitchenModal, setShowKitchenModal] = useState(false)
  const [kitchenForm, setKitchenForm] = useState({ soldier_id: '', date: '', meal: 'בוקר' })
  const [savingKitchen, setSavingKitchen] = useState(false)

  // Redistribute
  const [redistributing, setRedistributing] = useState<string | null>(null)

  const [rosterLabel, setRosterLabel] = useState('')

  const load = async () => {
    const now = new Date().toISOString()

    const [allSlotsRes, posRes, soldiersRes, swapsRes, hamalRes] = await Promise.all([
      fetch(`/api/guard-slots?from=${now}`).then(r => r.json()),
      fetch('/api/guard-positions').then(r => r.json()),
      fetch('/api/users').then(r => r.json()),
      fetch('/api/swap-requests?all=1').then(r => r.json()),
      fetch('/api/hamal-assignments').then(r => r.json()),
    ])

    const allFuture: GuardSlot[] = Array.isArray(allSlotsRes) ? allSlotsRes : []
    const filtered = allFuture
    if (allFuture.length > 0) {
      const earliest = new Date(allFuture[0].start_time)
      const latest   = new Date(allFuture[allFuture.length - 1].start_time)
      const pad = (n: number) => String(n).padStart(2, '0')
      const fmtDate = (d: Date) => `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`
      setRosterLabel(`${fmtDate(earliest)} – ${fmtDate(latest)}`)
    } else {
      setRosterLabel('')
    }

    setSlots(filtered)
    setPositions(Array.isArray(posRes) ? posRes : [])
    setSoldiers((Array.isArray(soldiersRes) ? soldiersRes : []).filter((u: User) => u.role === 'soldier'))
    setSwaps((Array.isArray(swapsRes) ? swapsRes : []).filter((s: SwapRequest) => s.status === 'pending'))
    setHamalSlots(Array.isArray(hamalRes) ? hamalRes : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const generate = async () => {
    if (!genForm.start_date || !genForm.end_date) return
    setGenerating(true)
    setGenMsg('')
    const res = await fetch('/api/guard-generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(genForm),
    })
    const data = await res.json()
    setGenerating(false)
    if (res.ok) {
      setGenMsg(`✓ נוצרו ${data.count} משמרות בהצלחה`)
      load()
    } else {
      setGenMsg(`✗ שגיאה: ${data.error}`)
    }
  }

  const deleteRoster = async () => {
    if (!confirm('האם למחוק את כל רשימת השמירה? פעולה זו בלתי הפיכה.')) return
    setDeleting(true)
    await fetch('/api/guard-slots?all=1', { method: 'DELETE' })
    setDeleting(false)
    setGenMsg('')
    load()
  }

  const addPosition = async () => {
    if (!posForm.name) return
    setAddingPos(true)
    await fetch('/api/guard-positions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: posForm.name,
        shift_duration_hours: parseInt(posForm.shift_duration_hours),
        slots_count: parseInt(posForm.slots_count) || 1,
        start_hour: parseInt(posForm.start_hour) || 0,
        category: posForm.category,
      }),
    })
    setPosForm({ name: '', shift_duration_hours: '4', slots_count: '1', start_hour: '0', category: 'guard' })
    setAddingPos(false)
    load()
  }

  const deletePosition = async (id: string) => {
    if (!confirm('האם למחוק עמדה זו?')) return
    await fetch(`/api/guard-positions?id=${id}`, { method: 'DELETE' })
    load()
  }

  const saveEditSlot = async () => {
    if (!editSlot || !editSoldierId) return
    await fetch('/api/guard-slots', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editSlot.id, soldier_id: editSoldierId }),
    })
    setEditSlot(null)
    load()
  }

  const deleteSlot = async (id: string) => {
    await fetch(`/api/guard-slots?id=${id}`, { method: 'DELETE' })
    load()
  }

  const decideSwap = async (id: string, status: 'approved' | 'rejected') => {
    await fetch('/api/swap-requests', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    load()
  }

  const redistribute = async (soldierId: string, name: string) => {
    if (!confirm(`הוצאת ${name} מרשימת השמירה. משמרותיו יחולקו לאחרים. להמשיך?`)) return
    setRedistributing(soldierId)
    const res = await fetch('/api/guard-redistribute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ soldier_id: soldierId }),
    })
    const data = await res.json()
    setRedistributing(null)
    if (res.ok) {
      alert(`חולקו מחדש ${data.redistributed} משמרות מתוך ${data.total}`)
    } else {
      alert(`שגיאה: ${data.error}`)
    }
    load()
  }

  const saveHamal = async () => {
    if (!hamalForm.soldier_id || !hamalForm.start_date || !hamalForm.end_date) return
    setSavingHamal(true)
    await fetch('/api/hamal-assignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(hamalForm),
    })
    setSavingHamal(false)
    setShowHamalModal(false)
    setHamalForm({ soldier_id: '', start_date: '', end_date: '' })
    load()
  }

  const removeHamal = async (id: string) => {
    await fetch(`/api/hamal-assignments?id=${id}`, { method: 'DELETE' })
    load()
  }

  const saveKitchen = async () => {
    if (!kitchenForm.soldier_id || !kitchenForm.date || !kitchenForm.meal) return
    setSavingKitchen(true)
    await fetch('/api/kitchen-assignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(kitchenForm),
    })
    setSavingKitchen(false)
    setShowKitchenModal(false)
    setKitchenForm({ soldier_id: '', date: '', meal: 'בוקר' })
    load()
  }

  const suggestKitchenSoldier = () => {
    // Count kitchen shifts this week from current slots
    const kitchenCounts: Record<string, number> = {}
    soldiers.forEach(s => { kitchenCounts[s.id] = 0 })
    slots.forEach(slot => {
      if (slot.guard_positions?.category === 'kitchen') {
        kitchenCounts[slot.soldier_id] = (kitchenCounts[slot.soldier_id] ?? 0) + 1
      }
    })
    // Also count hamal soldiers to exclude them
    const hamalIds = new Set(hamalSlots.map(h => h.soldier_id))
    const sorted = soldiers
      .filter(s => !hamalIds.has(s.id))
      .sort((a, b) => (kitchenCounts[a.id] ?? 0) - (kitchenCounts[b.id] ?? 0))
    return sorted[0]?.id ?? ''
  }

  if (loading) return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>טוען...</div>

  const positionColorMap: Record<string, typeof POSITION_COLORS[0]> = {}
  positions.filter(p => p.category === 'guard' || !p.category).forEach((p, i) => {
    positionColorMap[p.id] = POSITION_COLORS[i % POSITION_COLORS.length]
  })

  // Group guard+kitchen slots by day
  const days: Record<string, GuardSlot[]> = {}
  slots.forEach(slot => {
    const day = fmt(slot.start_time, 'date')
    if (!days[day]) days[day] = []
    days[day].push(slot)
  })

  // Shift counts per soldier for current week
  const guardCounts: Record<string, number> = {}
  const kitchenCounts: Record<string, number> = {}
  soldiers.forEach(s => { guardCounts[s.id] = 0; kitchenCounts[s.id] = 0 })
  slots.forEach(slot => {
    const cat = slot.guard_positions?.category
    if (!cat || cat === 'guard') guardCounts[slot.soldier_id] = (guardCounts[slot.soldier_id] ?? 0) + 1
    else if (cat === 'kitchen') kitchenCounts[slot.soldier_id] = (kitchenCounts[slot.soldier_id] ?? 0) + 1
  })

  const hamalSoldierIds = new Set(hamalSlots.map(h => h.soldier_id))
  const guardPositions = positions.filter(p => !p.category || p.category === 'guard')

  return (
    <div>
      <div className="page-header">
        <h1 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--sidebar)' }}>ניהול שמירה</h1>
        <div className="guard-tabs" style={{ display: 'flex', gap: '0.5rem' }}>
          {(['roster', 'positions', 'hamal', 'swaps'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: '0.35rem 0.9rem', borderRadius: '20px', border: '1.5px solid var(--primary)', background: tab === t ? 'var(--primary)' : 'transparent', color: tab === t ? 'white' : 'var(--primary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
              {{ roster: 'רשימה', positions: 'עמדות', hamal: `חמ"ל${hamalSlots.length > 0 ? ` (${hamalSlots.length})` : ''}`, swaps: `החלפות${swaps.length > 0 ? ` (${swaps.length})` : ''}` }[t]}
            </button>
          ))}
        </div>
      </div>

      {/* ─── ROSTER TAB ─── */}
      {tab === 'roster' && (
        <>
          <div className="card" style={{ marginBottom: '1.25rem' }}>
            <h2 className="section-title">יצירת רשימת שמירה אוטומטית</h2>
            <div className="generate-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto auto', gap: '0.75rem', alignItems: 'flex-end' }}>
              <div>
                <label className="label">מתאריך</label>
                <input type="date" className="input" value={genForm.start_date} onChange={e => setGenForm(f => ({ ...f, start_date: e.target.value }))} />
              </div>
              <div>
                <label className="label">עד תאריך</label>
                <input type="date" className="input" value={genForm.end_date} onChange={e => setGenForm(f => ({ ...f, end_date: e.target.value }))} />
              </div>
              <div>
                <label className="label">שעת עלייה / ירידה למשימה</label>
                <select className="input" value={genForm.mission_hour} onChange={e => setGenForm(f => ({ ...f, mission_hour: parseInt(e.target.value) }))}>
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                  ))}
                </select>
              </div>
              <button className="btn-primary" disabled={!genForm.start_date || !genForm.end_date || generating} onClick={generate} style={{ whiteSpace: 'nowrap' }}>
                {generating ? 'יוצר...' : '⚡ צור אוטומטית'}
              </button>
              <button className="btn-danger" disabled={deleting || slots.length === 0} onClick={deleteRoster} style={{ whiteSpace: 'nowrap' }}>
                {deleting ? 'מוחק...' : '🗑 מחק רשימה'}
              </button>
            </div>
            {genMsg && (
              <div style={{ marginTop: '0.75rem', padding: '0.6rem 0.9rem', borderRadius: '6px', background: genMsg.startsWith('✓') ? '#d4edda' : '#f8d7da', color: genMsg.startsWith('✓') ? '#155724' : '#721c24', fontSize: '0.875rem' }}>
                {genMsg}
              </div>
            )}
            {hamalSlots.length > 0 && (
              <p style={{ marginTop: '0.6rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {hamalSlots.length} חיילים בחמ"ל יוחרגו מחלוקת השמירה
              </p>
            )}
          </div>

          {/* Shift counts + הוצא מרשימה */}
          <div className="card" style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h2 className="section-title" style={{ margin: 0 }}>
                ספירת משמרות
                {rosterLabel && <span style={{ fontWeight: 400, fontSize: '0.82rem', color: 'var(--text-muted)', marginRight: '0.5rem' }}>{rosterLabel}</span>}
              </h2>
              <button className="btn-secondary" style={{ fontSize: '0.8rem', padding: '0.3rem 0.75rem' }}
                onClick={() => { setKitchenForm(f => ({ ...f, soldier_id: suggestKitchenSoldier() })); setShowKitchenModal(true) }}>
                + תורנות מטבח
              </button>
            </div>
            {soldiers.length === 0 ? (
              <div className="empty-state">אין חיילים</div>
            ) : (
              <div className="table-wrapper"><table className="table-base">
                <thead>
                  <tr><th>שם</th><th>שמירות</th><th>מטבח</th><th>חמ"ל</th><th>פעולה</th></tr>
                </thead>
                <tbody>
                  {soldiers.map(s => (
                    <tr key={s.id} style={{ opacity: hamalSoldierIds.has(s.id) ? 0.55 : 1 }}>
                      <td style={{ fontWeight: 600 }}>{s.name}</td>
                      <td style={{ textAlign: 'center' }}>{guardCounts[s.id] ?? 0}</td>
                      <td style={{ textAlign: 'center' }}>{kitchenCounts[s.id] ?? 0}</td>
                      <td style={{ textAlign: 'center' }}>
                        {hamalSoldierIds.has(s.id) ? <span style={{ background: '#fce4ec', color: '#880e4f', borderRadius: '4px', padding: '1px 6px', fontSize: '0.78rem', fontWeight: 600 }}>חמ"ל</span> : '—'}
                      </td>
                      <td>
                        <button
                          className="btn-danger"
                          style={{ padding: '0.2rem 0.6rem', fontSize: '0.78rem', whiteSpace: 'nowrap' }}
                          disabled={redistributing === s.id}
                          onClick={() => redistribute(s.id, s.name)}
                        >
                          {redistributing === s.id ? 'מחלק...' : 'הוצא מרשימה'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            )}
          </div>

          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h2 className="section-title" style={{ margin: 0 }}>
                רשימת שמירה קרובה
                {rosterLabel && <span style={{ fontWeight: 400, fontSize: '0.82rem', color: 'var(--text-muted)', marginRight: '0.5rem' }}>{rosterLabel}</span>}
              </h2>
              {slots.length > 0 && (
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{slots.length} משמרות</span>
              )}
            </div>

            {/* Position color legend */}
            {guardPositions.length > 0 && slots.length > 0 && (
              <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                {guardPositions.map(p => {
                  const col = positionColorMap[p.id]
                  if (!col) return null
                  return (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: col.bg, border: `1px solid ${col.dot}`, borderRadius: '20px', padding: '0.2rem 0.7rem', fontSize: '0.8rem', fontWeight: 600, color: col.text }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: col.dot, display: 'inline-block' }} />
                      {p.name}
                    </div>
                  )
                })}
              </div>
            )}

            {slots.length === 0 ? (
              <div className="empty-state">אין רשימת שמירה. צור אחת אוטומטית למעלה.</div>
            ) : (
              Object.entries(days).map(([day, daySlots]) => (
                <div key={day} style={{ marginBottom: '1.25rem' }}>
                  <div style={{ fontWeight: 700, color: 'var(--primary)', marginBottom: '0.5rem', fontSize: '0.9rem' }}>{day}</div>
                  <div className="table-wrapper"><table className="table-base">
                    <thead>
                      <tr><th>שעות</th><th>עמדה</th><th>חייל</th><th>פעולות</th></tr>
                    </thead>
                    <tbody>
                      {daySlots.map(slot => {
                        const cat = slot.guard_positions?.category ?? 'guard'
                        const col = positionColorMap[slot.position_id]
                        const catBadge = CATEGORY_BADGE[cat]
                        return (
                          <tr key={slot.id} style={{ background: cat === 'guard' ? col?.bg : catBadge?.bg }}>
                            <td style={{ fontFamily: 'monospace', direction: 'ltr', textAlign: 'left', fontSize: '0.85rem' }}>
                              {fmt(slot.start_time, 'time')} — {fmt(slot.end_time, 'time')}
                            </td>
                            <td>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600, color: cat === 'guard' ? col?.text : catBadge?.text }}>
                                {cat !== 'guard' && (
                                  <span style={{ background: catBadge?.bg, color: catBadge?.text, borderRadius: '4px', padding: '1px 5px', fontSize: '0.72rem', fontWeight: 700, border: `1px solid ${catBadge?.text}44` }}>
                                    {catBadge?.label}
                                  </span>
                                )}
                                {cat === 'guard' && col && (
                                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: col.dot, display: 'inline-block', flexShrink: 0 }} />
                                )}
                                {slot.guard_positions?.name || '—'}
                              </span>
                            </td>
                            <td>{slot.users?.name || '—'}</td>
                            <td style={{ display: 'flex', gap: '0.4rem' }}>
                              <button className="btn-secondary" style={{ padding: '0.2rem 0.55rem', fontSize: '0.78rem' }} onClick={() => { setEditSlot(slot); setEditSoldierId(slot.soldier_id) }}>החלף</button>
                              <button className="btn-danger" style={{ padding: '0.2rem 0.55rem', fontSize: '0.78rem' }} onClick={() => deleteSlot(slot.id)}>מחק</button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table></div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* ─── POSITIONS TAB ─── */}
      {tab === 'positions' && (
        <div className="card">
          <h2 className="section-title">ניהול עמדות</h2>

          <div style={{ padding: '1rem', background: 'var(--accent)', borderRadius: '8px', marginBottom: '1.5rem' }}>
            <div className="positions-form-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr auto', gap: '0.75rem', alignItems: 'flex-end' }}>
              <div>
                <label className="label">שם העמדה</label>
                <input className="input" placeholder="כניסה ראשית / עמדה צפון..." value={posForm.name} onChange={e => setPosForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="label">סוג</label>
                <select className="input" value={posForm.category} onChange={e => setPosForm(f => ({ ...f, category: e.target.value }))}>
                  <option value="guard">שמירה</option>
                  <option value="kitchen">מטבח</option>
                  <option value="hamal">חמ"ל</option>
                </select>
              </div>
              <div>
                <label className="label">משך משמרת</label>
                <select className="input" value={posForm.shift_duration_hours} onChange={e => setPosForm(f => ({ ...f, shift_duration_hours: e.target.value }))}>
                  {DURATION_OPTIONS.map(h => (
                    <option key={h} value={h}>{durationLabel(h)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">אנשים בעמדה</label>
                <select className="input" value={posForm.slots_count} onChange={e => setPosForm(f => ({ ...f, slots_count: e.target.value }))}>
                  {[1, 2, 3, 4, 5, 6].map(n => (
                    <option key={n} value={n}>{n} {n === 1 ? 'איש' : 'אנשים'}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">
                  שעת חילופים
                  {parseInt(posForm.shift_duration_hours) < 24 && (
                    <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> (לא רלוונטי)</span>
                  )}
                </label>
                <select
                  className="input"
                  value={posForm.start_hour}
                  onChange={e => setPosForm(f => ({ ...f, start_hour: e.target.value }))}
                  disabled={parseInt(posForm.shift_duration_hours) < 24}
                >
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>{String(h).padStart(2,'0')}:00</option>
                  ))}
                </select>
              </div>
              <button className="btn-primary" disabled={!posForm.name || addingPos} onClick={addPosition} style={{ whiteSpace: 'nowrap' }}>
                {addingPos ? 'מוסיף...' : '+ הוסף'}
              </button>
            </div>
          </div>

          {positions.length === 0 ? (
            <div className="empty-state">אין עמדות מוגדרות. הוסף עמדה ראשונה.</div>
          ) : (
            <div className="table-wrapper"><table className="table-base">
              <thead>
                <tr><th>שם העמדה</th><th>סוג</th><th>משך משמרת</th><th>שעת חילופים</th><th>אנשים</th><th>פעולות</th></tr>
              </thead>
              <tbody>
                {positions.map(p => {
                  const catBadge = CATEGORY_BADGE[p.category ?? 'guard']
                  return (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600 }}>{p.name}</td>
                      <td>
                        <span style={{ background: catBadge?.bg, color: catBadge?.text, borderRadius: '4px', padding: '2px 8px', fontSize: '0.78rem', fontWeight: 600 }}>
                          {catBadge?.label}
                        </span>
                      </td>
                      <td>{durationLabel(p.shift_duration_hours)}</td>
                      <td style={{ fontFamily: 'monospace' }}>{p.shift_duration_hours >= 24 ? `${String(p.start_hour ?? 0).padStart(2,'0')}:00` : '—'}</td>
                      <td style={{ textAlign: 'center' }}>{p.slots_count ?? 1}</td>
                      <td><button className="btn-danger" style={{ padding: '0.25rem 0.65rem', fontSize: '0.8rem' }} onClick={() => deletePosition(p.id)}>הסר</button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table></div>
          )}
        </div>
      )}

      {/* ─── HAMAL TAB ─── */}
      {tab === 'hamal' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 className="section-title" style={{ margin: 0 }}>הקצאות חמ"ל</h2>
            <button className="btn-primary" style={{ fontSize: '0.85rem' }} onClick={() => setShowHamalModal(true)}>
              + הקצה לחמ"ל
            </button>
          </div>
          <div style={{ background: '#fff8e1', border: '1px solid #ffc107', borderRadius: '6px', padding: '0.6rem 0.9rem', marginBottom: '1rem', fontSize: '0.8rem', color: '#856404' }}>
            חיילים שמוקצים לחמ"ל לא ייכללו בחלוקת השמירה האוטומטית. ניתן להוסיף ולהסיר חיילים בכל עת, כולל חיילים מסופחים.
          </div>
          {hamalSlots.length === 0 ? (
            <div className="empty-state">אין הקצאות חמ"ל כרגע</div>
          ) : (
            <div className="table-wrapper"><table className="table-base">
              <thead>
                <tr><th>חייל</th><th>מתאריך</th><th>עד תאריך</th><th>פעולות</th></tr>
              </thead>
              <tbody>
                {hamalSlots.map(h => (
                  <tr key={h.id} style={{ background: '#fce4ec' }}>
                    <td style={{ fontWeight: 600 }}>{h.users?.name || '—'}</td>
                    <td>{fmt(h.start_time, 'date')}</td>
                    <td>{fmt(h.end_time, 'date')}</td>
                    <td>
                      <button className="btn-danger" style={{ padding: '0.25rem 0.65rem', fontSize: '0.8rem' }} onClick={() => removeHamal(h.id)}>
                        הסר מחמ"ל
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </div>
      )}

      {/* ─── SWAPS TAB ─── */}
      {tab === 'swaps' && (
        <div className="card">
          <h2 className="section-title">בקשות החלפה ממתינות</h2>
          {swaps.length === 0 ? (
            <div className="empty-state">אין בקשות החלפה ממתינות</div>
          ) : (
            <div className="table-wrapper"><table className="table-base">
              <thead>
                <tr><th>מבקש</th><th>עם</th><th>משמרת</th><th>עמדה</th><th>סטטוס</th><th>פעולות</th></tr>
              </thead>
              <tbody>
                {swaps.map(s => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 600 }}>{s.requester?.name}</td>
                    <td>{s.target?.name}</td>
                    <td style={{ fontSize: '0.85rem' }}>{s.guard_slots ? fmt(s.guard_slots.start_time) : '—'}</td>
                    <td>{s.guard_slots?.guard_positions?.name || '—'}</td>
                    <td><StatusBadge status={s.status} /></td>
                    <td style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="btn-primary" style={{ padding: '0.25rem 0.65rem', fontSize: '0.8rem' }} onClick={() => decideSwap(s.id, 'approved')}>אשר</button>
                      <button className="btn-danger" style={{ padding: '0.25rem 0.65rem', fontSize: '0.8rem' }} onClick={() => decideSwap(s.id, 'rejected')}>דחה</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </div>
      )}

      {/* ─── EDIT SLOT MODAL ─── */}
      {editSlot && (
        <div className="modal-backdrop" onClick={() => setEditSlot(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>שינוי חייל למשמרת</h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              {editSlot.guard_positions?.name} — {fmt(editSlot.start_time, 'time')} – {fmt(editSlot.end_time, 'time')}
            </p>
            <div style={{ marginBottom: '1.25rem' }}>
              <label className="label">חייל</label>
              <select className="input" value={editSoldierId} onChange={e => setEditSoldierId(e.target.value)}>
                <option value="">— בחר חייל —</option>
                {soldiers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => setEditSlot(null)}>ביטול</button>
              <button className="btn-primary" disabled={!editSoldierId} onClick={saveEditSlot}>שמור</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── HAMAL MODAL ─── */}
      {showHamalModal && (
        <div className="modal-backdrop" onClick={() => setShowHamalModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>הקצאה לחמ"ל</h2>
            <div style={{ marginBottom: '0.75rem' }}>
              <label className="label">חייל</label>
              <select className="input" value={hamalForm.soldier_id} onChange={e => setHamalForm(f => ({ ...f, soldier_id: e.target.value }))}>
                <option value="">— בחר חייל —</option>
                {soldiers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div>
                <label className="label">מתאריך</label>
                <input type="date" className="input" value={hamalForm.start_date} onChange={e => setHamalForm(f => ({ ...f, start_date: e.target.value }))} />
              </div>
              <div>
                <label className="label">עד תאריך</label>
                <input type="date" className="input" value={hamalForm.end_date} onChange={e => setHamalForm(f => ({ ...f, end_date: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => setShowHamalModal(false)}>ביטול</button>
              <button className="btn-primary" disabled={!hamalForm.soldier_id || !hamalForm.start_date || !hamalForm.end_date || savingHamal} onClick={saveHamal}>
                {savingHamal ? 'שומר...' : 'הקצה'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── KITCHEN MODAL ─── */}
      {showKitchenModal && (
        <div className="modal-backdrop" onClick={() => setShowKitchenModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>הוספת תורנות מטבח</h2>
            <div style={{ marginBottom: '0.75rem' }}>
              <label className="label">חייל <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(מוצע: הכי פחות תורנויות)</span></label>
              <select className="input" value={kitchenForm.soldier_id} onChange={e => setKitchenForm(f => ({ ...f, soldier_id: e.target.value }))}>
                <option value="">— בחר חייל —</option>
                {soldiers.filter(s => !hamalSoldierIds.has(s.id)).map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({kitchenCounts[s.id] ?? 0} תורנויות)</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div>
                <label className="label">תאריך</label>
                <input type="date" className="input" value={kitchenForm.date} onChange={e => setKitchenForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div>
                <label className="label">ארוחה</label>
                <select className="input" value={kitchenForm.meal} onChange={e => setKitchenForm(f => ({ ...f, meal: e.target.value }))}>
                  {MEALS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => setShowKitchenModal(false)}>ביטול</button>
              <button className="btn-primary" disabled={!kitchenForm.soldier_id || !kitchenForm.date || savingKitchen} onClick={saveKitchen}>
                {savingKitchen ? 'שומר...' : 'הוסף תורנות'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
