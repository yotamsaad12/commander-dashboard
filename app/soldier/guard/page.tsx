'use client'

import { useState, useEffect } from 'react'
import { useSession } from '@/contexts/SessionContext'
import { GuardSlot, User, SwapRequest } from '@/lib/types'
import StatusBadge from '@/components/StatusBadge'

function formatDateTime(iso: string) {
  const d = new Date(iso)
  return `${d.toLocaleDateString('he-IL')} ${d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`
}

export default function SoldierGuardPage() {
  const { session } = useSession()
  const [allSlots, setAllSlots] = useState<GuardSlot[]>([])
  const [mySlots, setMySlots] = useState<GuardSlot[]>([])
  const [soldiers, setSoldiers] = useState<User[]>([])
  const [swapRequests, setSwapRequests] = useState<SwapRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [myOnly, setMyOnly] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<GuardSlot | null>(null)
  const [targetId, setTargetId] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = async () => {
    if (!session) return
    const now = new Date().toISOString()
    const [allRes, soldiersRes, swapsRes] = await Promise.all([
      fetch(`/api/guard-slots?from=${now}`).then(r => r.json()),
      fetch('/api/users').then(r => r.json()),
      fetch(`/api/swap-requests?userId=${session.id}`).then(r => r.json()),
    ])
    const allFuture: GuardSlot[] = Array.isArray(allRes) ? allRes : []

    // Find the nearest roster period: take the earliest slot's date and show all slots on the same calendar day range
    let all = allFuture
    if (allFuture.length > 0) {
      const earliest = new Date(allFuture[0].start_time)
      const periodStart = new Date(earliest)
      periodStart.setHours(0, 0, 0, 0)
      // Find the last slot that starts within 7 days of the earliest
      const periodEnd = new Date(periodStart)
      periodEnd.setDate(periodEnd.getDate() + 6)
      periodEnd.setHours(23, 59, 59, 999)
      all = allFuture.filter(s => new Date(s.start_time) <= periodEnd)
    }

    setAllSlots(all)
    setMySlots(all.filter((s: GuardSlot) => s.soldier_id === session.id))
    setSoldiers(Array.isArray(soldiersRes) ? soldiersRes.filter((u: User) => u.id !== session.id && u.role === 'soldier') : [])
    setSwapRequests(Array.isArray(swapsRes) ? swapsRes : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [session])

  const openSwap = (slot: GuardSlot) => {
    setSelectedSlot(slot)
    setTargetId('')
    setShowModal(true)
  }

  const submitSwap = async () => {
    if (!selectedSlot || !targetId || !session) return
    setSubmitting(true)
    await fetch('/api/swap-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requester_id: session.id, target_id: targetId, slot_id: selectedSlot.id }),
    })
    setShowModal(false)
    setSubmitting(false)
    load()
  }

  if (loading) return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>טוען...</div>

  const displayedSlots = myOnly ? allSlots.filter(s => s.soldier_id === session?.id) : allSlots
  const days: Record<string, GuardSlot[]> = {}
  displayedSlots.forEach(slot => {
    const day = new Date(slot.start_time).toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })
    if (!days[day]) days[day] = []
    days[day].push(slot)
  })

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--sidebar)' }}>רשימת שמירה קרובה</h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            {allSlots.length > 0
              ? new Date(allSlots[0].start_time).toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' })
              : myOnly ? `מציג ${mySlots.length} משמרות שלך בלבד` : 'השמירות שלך מסומנות'}
          </p>
        </div>
        <button
          onClick={() => setMyOnly(v => !v)}
          style={{
            padding: '0.4rem 1rem',
            borderRadius: '20px',
            border: '1.5px solid var(--primary)',
            background: myOnly ? 'var(--primary)' : 'transparent',
            color: myOnly ? 'white' : 'var(--primary)',
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: 600,
            transition: 'all 0.15s',
            whiteSpace: 'nowrap',
          }}
        >
          {myOnly ? '✓ השמירות שלי' : '👤 הצג רק שלי'}
        </button>
      </div>

      {allSlots.length === 0 ? (
        <div className="card"><div className="empty-state">אין רשימת שמירה לשבוע זה</div></div>
      ) : displayedSlots.length === 0 ? (
        <div className="card"><div className="empty-state">אין לך משמרות השבוע</div></div>
      ) : (
        Object.entries(days).map(([day, slots]) => (
          <div key={day} className="card" style={{ marginBottom: '1rem' }}>
            <h3 style={{ fontWeight: 700, color: 'var(--primary)', marginBottom: '0.75rem', fontSize: '0.95rem' }}>{day}</h3>
            <div className="table-wrapper"><table className="table-base">
              <thead>
                <tr>
                  <th>שעות</th>
                  <th>עמדה</th>
                  <th>חייל</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {slots.map(slot => {
                  const isMine = slot.soldier_id === session?.id
                  return (
                    <tr key={slot.id} style={{ background: isMine ? '#e8f5e9' : undefined }}>
                      <td style={{ fontWeight: isMine ? 700 : 400, fontSize: '0.85rem', fontFamily: 'monospace', direction: 'ltr', textAlign: 'left' }}>
                        {new Date(slot.start_time).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                        {' — '}
                        {new Date(slot.end_time).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td>{slot.guard_positions?.name || '—'}</td>
                      <td style={{ fontWeight: isMine ? 700 : 400, color: isMine ? 'var(--primary)' : undefined }}>
                        {isMine ? `✓ ${session?.name} (אני)` : slot.users?.name || '—'}
                      </td>
                      <td>
                        {isMine && (
                          <button className="btn-secondary" style={{ padding: '0.25rem 0.65rem', fontSize: '0.8rem' }} onClick={() => openSwap(slot)}>
                            בקש החלפה
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table></div>
          </div>
        ))
      )}

      {swapRequests.length > 0 && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <h2 className="section-title">בקשות החלפה שלי</h2>
          <div className="table-wrapper"><table className="table-base">
            <thead>
              <tr>
                <th>משמרת</th>
                <th>עם</th>
                <th>סטטוס</th>
              </tr>
            </thead>
            <tbody>
              {swapRequests.map(r => (
                <tr key={r.id}>
                  <td style={{ fontSize: '0.85rem' }}>{r.guard_slots ? formatDateTime(r.guard_slots.start_time) : '—'}</td>
                  <td>{r.requester_id === session?.id ? r.target?.name : r.requester?.name}</td>
                  <td><StatusBadge status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}

      {showModal && selectedSlot && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>בקשת החלפת משמרת</h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              {selectedSlot.guard_positions?.name} — {formatDateTime(selectedSlot.start_time)}
            </p>

            <div style={{ marginBottom: '1.25rem' }}>
              <label className="label">בחר חייל להחלפה</label>
              <select className="input" value={targetId} onChange={e => setTargetId(e.target.value)}>
                <option value="">— בחר חייל —</option>
                {soldiers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => setShowModal(false)}>ביטול</button>
              <button className="btn-primary" disabled={!targetId || submitting} onClick={submitSwap}>
                {submitting ? 'שולח...' : 'שלח בקשה'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
