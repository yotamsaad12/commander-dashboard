'use client'

import { useState, useEffect } from 'react'
import { useSession } from '@/contexts/SessionContext'
import { Constraint } from '@/lib/types'
import StatusBadge from '@/components/StatusBadge'

export default function SoldierConstraintsPage() {
  const { session } = useSession()
  const [constraints, setConstraints] = useState<Constraint[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ start_date: '', end_date: '', reason: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    if (!session) return
    const data = await fetch(`/api/constraints?userId=${session.id}`).then(r => r.json())
    setConstraints(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [session])

  const minAllowedDate = () => {
    const d = new Date()
    d.setDate(d.getDate() + 7)
    return d.toISOString().split('T')[0]
  }

  const dateWarning = () => {
    if (!form.start_date) return ''
    const today = new Date(); today.setHours(0,0,0,0)
    const minDate = new Date(today.getTime() + 7 * 24 * 3600 * 1000)
    if (new Date(form.start_date) < minDate) {
      return 'אילוץ חייב להיות מוגש לפחות שבוע מראש. אם פספסת את החלון — עליך למצוא חילוף לשמירות שלך.'
    }
    return ''
  }

  const submit = async () => {
    setError('')
    if (!form.start_date || !form.end_date || !form.reason.trim()) {
      setError('יש למלא את כל השדות')
      return
    }
    if (form.end_date < form.start_date) {
      setError('תאריך הסיום לא יכול להיות לפני תאריך ההתחלה')
      return
    }
    setSubmitting(true)
    const res = await fetch('/api/constraints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: session?.id, ...form }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'שגיאה בשליחת הבקשה')
      setSubmitting(false)
      return
    }
    setForm({ start_date: '', end_date: '', reason: '' })
    setShowModal(false)
    setSubmitting(false)
    load()
  }

  if (loading) return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>טוען...</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <h1 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--sidebar)' }}>האילוצים שלי</h1>
        <button className="btn-primary" onClick={() => setShowModal(true)}>+ בקשת אילוץ חדשה</button>
      </div>

      <div className="card">
        {constraints.length === 0 ? (
          <div className="empty-state">אין בקשות אילוץ</div>
        ) : (
          <div className="table-wrapper"><table className="table-base">
            <thead>
              <tr>
                <th>מתאריך</th>
                <th>עד תאריך</th>
                <th>סיבה</th>
                <th>סטטוס</th>
                <th>הערת מפקד</th>
              </tr>
            </thead>
            <tbody>
              {constraints.map(c => (
                <tr key={c.id}>
                  <td>{new Date(c.start_date).toLocaleDateString('he-IL')}</td>
                  <td>{new Date(c.end_date).toLocaleDateString('he-IL')}</td>
                  <td>{c.reason}</td>
                  <td><StatusBadge status={c.status} /></td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{c.commander_note || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>בקשת אילוץ חדשה</h2>

            <div style={{ background: '#fff8e1', border: '1px solid #ffc107', borderRadius: '6px', padding: '0.6rem 0.9rem', marginBottom: '1rem', fontSize: '0.8rem', color: '#856404' }}>
              ⚠️ אילוץ חייב להיות מוגש <strong>לפחות שבוע מראש</strong>. אם לא הוגש בזמן — עליך למצוא חילוף לשמירות שלך.
            </div>

            {error && <div style={{ background: '#f8d7da', color: '#721c24', borderRadius: '6px', padding: '0.6rem', marginBottom: '1rem', fontSize: '0.85rem' }}>{error}</div>}

            {dateWarning() && !error && (
              <div style={{ background: '#f8d7da', color: '#721c24', borderRadius: '6px', padding: '0.6rem', marginBottom: '1rem', fontSize: '0.85rem' }}>
                ❌ {dateWarning()}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div>
                <label className="label">מתאריך <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(מינימום {minAllowedDate()})</span></label>
                <input type="date" className="input" min={minAllowedDate()} value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
              </div>
              <div>
                <label className="label">עד תאריך</label>
                <input type="date" className="input" min={form.start_date || minAllowedDate()} value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
              </div>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label className="label">סיבת העדרות</label>
              <textarea
                className="input"
                rows={3}
                placeholder="תאר את סיבת ההעדרות..."
                value={form.reason}
                onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                style={{ resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => setShowModal(false)}>ביטול</button>
              <button className="btn-primary" disabled={submitting} onClick={submit}>
                {submitting ? 'שולח...' : 'שלח בקשה'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
