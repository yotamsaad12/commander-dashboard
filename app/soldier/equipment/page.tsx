'use client'

import { useState, useEffect } from 'react'
import { useSession } from '@/contexts/SessionContext'
import { Equipment, EquipmentRequest } from '@/lib/types'
import StatusBadge from '@/components/StatusBadge'

export default function SoldierEquipmentPage() {
  const { session } = useSession()
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [requests, setRequests] = useState<EquipmentRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [desc, setDesc] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = async () => {
    if (!session) return
    const [eqRes, reqRes] = await Promise.all([
      fetch(`/api/equipment?userId=${session.id}`).then(r => r.json()),
      fetch(`/api/equipment-requests?userId=${session.id}`).then(r => r.json()),
    ])
    setEquipment(Array.isArray(eqRes) ? eqRes : [])
    setRequests(Array.isArray(reqRes) ? reqRes : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [session])

  const submitRequest = async () => {
    if (!desc.trim() || !session) return
    setSubmitting(true)
    await fetch('/api/equipment-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: session.id, description: desc }),
    })
    setDesc('')
    setShowModal(false)
    setSubmitting(false)
    load()
  }

  if (loading) return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>טוען...</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <h1 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--sidebar)' }}>הציוד שלי</h1>
        <button className="btn-primary" onClick={() => setShowModal(true)}>+ בקשה לציוד חסר</button>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 className="section-title">ציוד משויך</h2>
        {equipment.length === 0 ? (
          <div className="empty-state">אין ציוד משויך כרגע</div>
        ) : (
          <div className="table-wrapper"><table className="table-base">
            <thead>
              <tr>
                <th>סוג ציוד</th>
                <th>מספר סידורי</th>
                <th>הערות</th>
              </tr>
            </thead>
            <tbody>
              {equipment.map(eq => (
                <tr key={eq.id}>
                  <td style={{ fontWeight: 600 }}>{eq.type}</td>
                  <td style={{ fontFamily: 'monospace', direction: 'ltr', textAlign: 'left' }}>{eq.serial_number}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{eq.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>

      <div className="card">
        <h2 className="section-title">בקשות ציוד</h2>
        {requests.length === 0 ? (
          <div className="empty-state">אין בקשות</div>
        ) : (
          <div className="table-wrapper"><table className="table-base">
            <thead>
              <tr>
                <th>תיאור הבקשה</th>
                <th>סטטוס</th>
                <th>תאריך</th>
              </tr>
            </thead>
            <tbody>
              {requests.map(r => (
                <tr key={r.id}>
                  <td>{r.description}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{new Date(r.created_at).toLocaleDateString('he-IL')}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>בקשה לציוד חסר</h2>
            <div style={{ marginBottom: '1rem' }}>
              <label className="label">תיאור הציוד החסר</label>
              <textarea
                className="input"
                rows={4}
                placeholder="תאר את הציוד החסר..."
                value={desc}
                onChange={e => setDesc(e.target.value)}
                style={{ resize: 'vertical' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => setShowModal(false)}>ביטול</button>
              <button className="btn-primary" disabled={!desc.trim() || submitting} onClick={submitRequest}>
                {submitting ? 'שולח...' : 'שלח בקשה'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
