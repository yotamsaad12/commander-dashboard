'use client'

import { useState, useEffect } from 'react'
import { Constraint } from '@/lib/types'
import StatusBadge from '@/components/StatusBadge'

export default function CommanderConstraintsPage() {
  const [constraints, setConstraints] = useState<Constraint[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending')
  const [noteModal, setNoteModal] = useState<{ id: string; action: 'approved' | 'rejected' } | null>(null)
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = async () => {
    const url = filter === 'all' ? '/api/constraints' : `/api/constraints?status=${filter}`
    const data = await fetch(url).then(r => r.json())
    setConstraints(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { setLoading(true); load() }, [filter])

  const openDecision = (id: string, action: 'approved' | 'rejected') => {
    setNoteModal({ id, action })
    setNote('')
  }

  const decide = async () => {
    if (!noteModal) return
    setSubmitting(true)
    await fetch('/api/constraints', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: noteModal.id, status: noteModal.action, commander_note: note }),
    })
    setNoteModal(null)
    setSubmitting(false)
    load()
  }

  const daysCount = (start: string, end: string) => {
    const diff = new Date(end).getTime() - new Date(start).getTime()
    return Math.ceil(diff / 86400000) + 1
  }

  return (
    <div>
      <div className="page-header">
        <h1 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--sidebar)' }}>ניהול אילוצים</h1>
        <div className="filter-tabs" style={{ display: 'flex', gap: '0.5rem' }}>
          {(['pending', 'approved', 'rejected', 'all'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '0.35rem 0.9rem',
                borderRadius: '20px',
                border: '1.5px solid var(--primary)',
                background: filter === f ? 'var(--primary)' : 'transparent',
                color: filter === f ? 'white' : 'var(--primary)',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: 600,
              }}
            >
              {{ all: 'הכל', pending: 'ממתינים', approved: 'מאושרים', rejected: 'נדחו' }[f]}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="empty-state">טוען...</div>
        ) : constraints.length === 0 ? (
          <div className="empty-state">אין בקשות להצגה</div>
        ) : (
          <div className="table-wrapper"><table className="table-base">
            <thead>
              <tr>
                <th>חייל</th>
                <th>מתאריך</th>
                <th>עד תאריך</th>
                <th>ימים</th>
                <th>סיבה</th>
                <th>סטטוס</th>
                {filter === 'pending' && <th>פעולות</th>}
                {filter !== 'pending' && <th>הערה</th>}
              </tr>
            </thead>
            <tbody>
              {constraints.map(c => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600 }}>{c.users?.name}</td>
                  <td>{new Date(c.start_date).toLocaleDateString('he-IL')}</td>
                  <td>{new Date(c.end_date).toLocaleDateString('he-IL')}</td>
                  <td style={{ textAlign: 'center' }}>{daysCount(c.start_date, c.end_date)}</td>
                  <td>{c.reason}</td>
                  <td><StatusBadge status={c.status} /></td>
                  {filter === 'pending' && (
                    <td style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="btn-primary" style={{ padding: '0.25rem 0.65rem', fontSize: '0.8rem' }} onClick={() => openDecision(c.id, 'approved')}>אשר</button>
                      <button className="btn-danger" style={{ padding: '0.25rem 0.65rem', fontSize: '0.8rem' }} onClick={() => openDecision(c.id, 'rejected')}>דחה</button>
                    </td>
                  )}
                  {filter !== 'pending' && (
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{c.commander_note || '—'}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>

      {noteModal && (
        <div className="modal-backdrop" onClick={() => setNoteModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{noteModal.action === 'approved' ? '✓ אישור בקשת אילוץ' : '✗ דחיית בקשת אילוץ'}</h2>
            <div style={{ marginBottom: '1.25rem' }}>
              <label className="label">הערה למגיש הבקשה (אופציונלי)</label>
              <textarea
                className="input"
                rows={3}
                placeholder="הוסף הערה..."
                value={note}
                onChange={e => setNote(e.target.value)}
                style={{ resize: 'vertical' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => setNoteModal(null)}>ביטול</button>
              <button
                className={noteModal.action === 'approved' ? 'btn-primary' : 'btn-danger'}
                disabled={submitting}
                onClick={decide}
              >
                {submitting ? 'מעדכן...' : noteModal.action === 'approved' ? 'אשר בקשה' : 'דחה בקשה'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
