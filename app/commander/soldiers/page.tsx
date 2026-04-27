'use client'

import { useState, useEffect } from 'react'
import { User } from '@/lib/types'

export default function CommanderSoldiersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ name: '', role: 'soldier' as 'soldier' | 'commander' })
  const [submitting, setSubmitting] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)

  const load = async () => {
    const data = await fetch('/api/users').then(r => r.json())
    setUsers(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const togglePresence = async (user: User) => {
    setToggling(user.id)
    await fetch('/api/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: user.id, is_present: !user.is_present }),
    })
    setToggling(null)
    load()
  }

  const add = async () => {
    if (!form.name.trim()) return
    setSubmitting(true)
    await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setForm({ name: '', role: 'soldier' })
    setShowModal(false)
    setSubmitting(false)
    load()
  }

  const remove = async (id: string, name: string) => {
    if (!confirm(`האם להסיר את ${name} מהמערכת?`)) return
    await fetch(`/api/users?id=${id}`, { method: 'DELETE' })
    load()
  }

  if (loading) return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>טוען...</div>

  const soldiers = users.filter(u => u.role === 'soldier')
  const commanders = users.filter(u => u.role === 'commander')
  const presentCount = users.filter(u => u.is_present).length
  const totalCount = users.length

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--sidebar)' }}>ניהול אנשי צוות</h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            {presentCount} מתוך {totalCount} נמצאים
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowModal(true)}>+ הוסף איש צוות</button>
      </div>

      {/* Summary badges */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <div style={{ background: '#d4edda', border: '1px solid #28a745', borderRadius: '8px', padding: '0.6rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.1rem' }}>✅</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#155724' }}>{presentCount}</div>
            <div style={{ fontSize: '0.75rem', color: '#155724' }}>נמצאים</div>
          </div>
        </div>
        <div style={{ background: '#f8d7da', border: '1px solid #dc3545', borderRadius: '8px', padding: '0.6rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.1rem' }}>❌</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#721c24' }}>{totalCount - presentCount}</div>
            <div style={{ fontSize: '0.75rem', color: '#721c24' }}>לא נמצאים</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 className="section-title">חיילים ({soldiers.length})</h2>
        {soldiers.length === 0 ? (
          <div className="empty-state">אין חיילים. הוסף חייל ראשון.</div>
        ) : (
          <div className="table-wrapper"><table className="table-base">
            <thead>
              <tr>
                <th>#</th>
                <th>שם</th>
                <th style={{ textAlign: 'center' }}>סטטוס נוכחות</th>
                <th>פעולות</th>
              </tr>
            </thead>
            <tbody>
              {soldiers.map((u, i) => (
                <tr key={u.id} style={{ background: u.is_present ? undefined : '#fff8f8' }}>
                  <td style={{ color: 'var(--text-muted)', width: '40px' }}>{i + 1}</td>
                  <td style={{ fontWeight: 600 }}>{u.name}</td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      onClick={() => togglePresence(u)}
                      disabled={toggling === u.id}
                      style={{
                        border: 'none',
                        borderRadius: '20px',
                        padding: '0.3rem 1rem',
                        cursor: toggling === u.id ? 'wait' : 'pointer',
                        fontWeight: 700,
                        fontSize: '0.82rem',
                        background: u.is_present ? '#d4edda' : '#f8d7da',
                        color: u.is_present ? '#155724' : '#721c24',
                        transition: 'all 0.15s',
                        minWidth: '90px',
                      }}
                    >
                      {toggling === u.id ? '...' : u.is_present ? '✓ נמצא' : '✗ לא נמצא'}
                    </button>
                  </td>
                  <td>
                    <button className="btn-danger" style={{ padding: '0.25rem 0.65rem', fontSize: '0.8rem' }} onClick={() => remove(u.id, u.name)}>הסר</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>

      {commanders.length > 0 && (
        <div className="card">
          <h2 className="section-title">מפקדים ({commanders.length})</h2>
          <div className="table-wrapper"><table className="table-base">
            <thead>
              <tr><th>שם</th><th style={{ textAlign: 'center' }}>סטטוס נוכחות</th><th>פעולות</th></tr>
            </thead>
            <tbody>
              {commanders.map(u => (
                <tr key={u.id} style={{ background: u.is_present ? undefined : '#fff8f8' }}>
                  <td style={{ fontWeight: 600 }}>{u.name}</td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      onClick={() => togglePresence(u)}
                      disabled={toggling === u.id}
                      style={{
                        border: 'none',
                        borderRadius: '20px',
                        padding: '0.3rem 1rem',
                        cursor: toggling === u.id ? 'wait' : 'pointer',
                        fontWeight: 700,
                        fontSize: '0.82rem',
                        background: u.is_present ? '#d4edda' : '#f8d7da',
                        color: u.is_present ? '#155724' : '#721c24',
                        transition: 'all 0.15s',
                        minWidth: '90px',
                      }}
                    >
                      {toggling === u.id ? '...' : u.is_present ? '✓ נמצא' : '✗ לא נמצא'}
                    </button>
                  </td>
                  <td>
                    <button className="btn-danger" style={{ padding: '0.25rem 0.65rem', fontSize: '0.8rem' }} onClick={() => remove(u.id, u.name)}>הסר</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>הוספת איש צוות</h2>
            <div style={{ marginBottom: '0.75rem' }}>
              <label className="label">שם מלא</label>
              <input className="input" placeholder="שם מלא..." value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div style={{ marginBottom: '1.25rem' }}>
              <label className="label">תפקיד</label>
              <select className="input" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as 'soldier' | 'commander' }))}>
                <option value="soldier">חייל</option>
                <option value="commander">מפקד</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => setShowModal(false)}>ביטול</button>
              <button className="btn-primary" disabled={!form.name.trim() || submitting} onClick={add}>
                {submitting ? 'מוסיף...' : 'הוסף'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
