'use client'

import { useState, useEffect } from 'react'
import { GuardSlot, GuardPosition, User, SwapRequest } from '@/lib/types'
import StatusBadge from '@/components/StatusBadge'

function fmt(iso: string, mode: 'date' | 'time' | 'both' = 'both') {
  const d = new Date(iso)
  if (mode === 'date') return d.toLocaleDateString('he-IL')
  if (mode === 'time') return d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
  return `${d.toLocaleDateString('he-IL')} ${d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`
}

function durationLabel(hours: number) {
  if (hours < 24) return `${hours} שעות`
  const days = hours / 24
  return days === 1 ? 'יום אחד' : `${days} ימים`
}

const DURATION_OPTIONS = [2, 3, 4, 6, 8, 12, 24, 48, 72]

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

export default function CommanderGuardPage() {
  const [slots, setSlots] = useState<GuardSlot[]>([])
  const [positions, setPositions] = useState<GuardPosition[]>([])
  const [soldiers, setSoldiers] = useState<User[]>([])
  const [swaps, setSwaps] = useState<SwapRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'roster' | 'positions' | 'swaps'>('roster')

  const [genForm, setGenForm] = useState({ start_date: '', end_date: '' })
  const [generating, setGenerating] = useState(false)
  const [genMsg, setGenMsg] = useState('')
  const [deleting, setDeleting] = useState(false)

  const [posForm, setPosForm] = useState({ name: '', shift_duration_hours: '4', slots_count: '1', start_hour: '0' })
  const [addingPos, setAddingPos] = useState(false)

  const [editSlot, setEditSlot] = useState<GuardSlot | null>(null)
  const [editSoldierId, setEditSoldierId] = useState('')

  const load = async () => {
    const now = new Date()
    const from = new Date(now); from.setHours(0, 0, 0, 0)
    const to = new Date(from); to.setDate(to.getDate() + 6); to.setHours(23, 59, 59)

    const [slotsRes, posRes, soldiersRes, swapsRes] = await Promise.all([
      fetch(`/api/guard-slots?from=${from.toISOString()}&to=${to.toISOString()}`).then(r => r.json()),
      fetch('/api/guard-positions').then(r => r.json()),
      fetch('/api/users').then(r => r.json()),
      fetch('/api/swap-requests?all=1').then(r => r.json()),
    ])
    setSlots(Array.isArray(slotsRes) ? slotsRes : [])
    setPositions(Array.isArray(posRes) ? posRes : [])
    setSoldiers((Array.isArray(soldiersRes) ? soldiersRes : []).filter((u: User) => u.role === 'soldier'))
    setSwaps((Array.isArray(swapsRes) ? swapsRes : []).filter((s: SwapRequest) => s.status === 'pending'))
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
      }),
    })
    setPosForm({ name: '', shift_duration_hours: '4', slots_count: '1', start_hour: '0' })
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

  if (loading) return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>טוען...</div>

  const positionColorMap: Record<string, typeof POSITION_COLORS[0]> = {}
  positions.forEach((p, i) => {
    positionColorMap[p.id] = POSITION_COLORS[i % POSITION_COLORS.length]
  })

  const days: Record<string, GuardSlot[]> = {}
  slots.forEach(slot => {
    const day = fmt(slot.start_time, 'date')
    if (!days[day]) days[day] = []
    days[day].push(slot)
  })

  return (
    <div>
      <div className="page-header">
        <h1 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--sidebar)' }}>ניהול שמירה</h1>
        <div className="guard-tabs" style={{ display: 'flex', gap: '0.5rem' }}>
          {(['roster', 'positions', 'swaps'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: '0.35rem 0.9rem', borderRadius: '20px', border: '1.5px solid var(--primary)', background: tab === t ? 'var(--primary)' : 'transparent', color: tab === t ? 'white' : 'var(--primary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
              {{ roster: 'רשימה', positions: 'עמדות', swaps: `החלפות${swaps.length > 0 ? ` (${swaps.length})` : ''}` }[t]}
            </button>
          ))}
        </div>
      </div>

      {tab === 'roster' && (
        <>
          <div className="card" style={{ marginBottom: '1.25rem' }}>
            <h2 className="section-title">יצירת רשימת שמירה אוטומטית</h2>
            <div className="generate-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: '0.75rem', alignItems: 'flex-end' }}>
              <div>
                <label className="label">מתאריך</label>
                <input type="date" className="input" value={genForm.start_date} onChange={e => setGenForm(f => ({ ...f, start_date: e.target.value }))} />
              </div>
              <div>
                <label className="label">עד תאריך</label>
                <input type="date" className="input" value={genForm.end_date} onChange={e => setGenForm(f => ({ ...f, end_date: e.target.value }))} />
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
            <p style={{ marginTop: '0.6rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              המערכת תחשב חלוקה שיוויונית בין {soldiers.length} חיילים תוך התחשבות באילוצים מאושרים
            </p>
          </div>

          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h2 className="section-title" style={{ margin: 0 }}>רשימת שמירה — השבוע</h2>
              {slots.length > 0 && (
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{slots.length} משמרות</span>
              )}
            </div>

            {/* Position color legend */}
            {positions.length > 0 && slots.length > 0 && (
              <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                {positions.map(p => {
                  const col = positionColorMap[p.id]
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
                        const col = positionColorMap[slot.position_id]
                        return (
                          <tr key={slot.id} style={{ background: col?.bg }}>
                            <td style={{ fontFamily: 'monospace', direction: 'ltr', textAlign: 'left', fontSize: '0.85rem' }}>
                              {fmt(slot.start_time, 'time')} — {fmt(slot.end_time, 'time')}
                            </td>
                            <td>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600, color: col?.text }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: col?.dot, display: 'inline-block', flexShrink: 0 }} />
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

      {tab === 'positions' && (
        <div className="card">
          <h2 className="section-title">ניהול עמדות</h2>

          <div style={{ padding: '1rem', background: 'var(--accent)', borderRadius: '8px', marginBottom: '1.5rem' }}>
            <div className="positions-form-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: '0.75rem', alignItems: 'flex-end' }}>
              <div>
                <label className="label">שם העמדה</label>
                <input className="input" placeholder="כניסה ראשית / עמדה צפון..." value={posForm.name} onChange={e => setPosForm(f => ({ ...f, name: e.target.value }))} />
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
                <tr><th>שם העמדה</th><th>משך משמרת</th><th>שעת חילופים</th><th>אנשים</th><th>פעולות</th></tr>
              </thead>
              <tbody>
                {positions.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600 }}>{p.name}</td>
                    <td>{durationLabel(p.shift_duration_hours)}</td>
                    <td style={{ fontFamily: 'monospace' }}>{p.shift_duration_hours >= 24 ? `${String(p.start_hour ?? 0).padStart(2,'0')}:00` : '—'}</td>
                    <td style={{ textAlign: 'center' }}>{p.slots_count ?? 1}</td>
                    <td><button className="btn-danger" style={{ padding: '0.25rem 0.65rem', fontSize: '0.8rem' }} onClick={() => deletePosition(p.id)}>הסר</button></td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </div>
      )}

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
    </div>
  )
}
