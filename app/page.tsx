'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { setSession } from '@/lib/session'
import { User } from '@/lib/types'
import { useSession } from '@/contexts/SessionContext'

export default function LoginPage() {
  const router = useRouter()
  const { session, loading, refresh } = useSession()
  const [users, setUsers] = useState<User[]>([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<User | null>(null)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!loading && session) {
      router.replace(session.role === 'commander' ? '/commander/equipment' : '/soldier/equipment')
    }
  }, [session, loading, router])

  useEffect(() => {
    fetch('/api/users')
      .then(r => r.json())
      .then(data => { setUsers(data); setFetching(false) })
      .catch(() => { setError('שגיאה בטעינת המשתמשים'); setFetching(false) })
  }, [])

  const filtered = users.filter(u => u.name.includes(search))

  const handleEnter = () => {
    if (!selected) return
    setSession({ id: selected.id, name: selected.name, role: selected.role })
    window.location.href = selected.role === 'commander' ? '/commander/equipment' : '/soldier/equipment'
  }

  if (loading) return null

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: '1rem' }}>
      <div style={{ background: 'white', borderRadius: '16px', padding: '2.5rem', width: '100%', maxWidth: '420px', boxShadow: '0 8px 40px rgba(0,0,0,0.12)' }}>

        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🪖</div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--sidebar)', margin: 0 }}>מערכת ניהול מילואים</h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>בחר את שמך מהרשימה כדי להיכנס</p>
        </div>

        {error && (
          <div style={{ background: '#f8d7da', color: '#721c24', borderRadius: '6px', padding: '0.75rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
            {error}
          </div>
        )}

        <div style={{ marginBottom: '1rem' }}>
          <label className="label">חיפוש שם</label>
          <input
            className="input"
            placeholder="הקלד שם..."
            value={search}
            onChange={e => { setSearch(e.target.value); setSelected(null) }}
          />
        </div>

        <div style={{ border: '1.5px solid var(--border)', borderRadius: '8px', maxHeight: '240px', overflowY: 'auto', marginBottom: '1.25rem' }}>
          {fetching ? (
            <div className="empty-state">טוען...</div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">לא נמצאו תוצאות</div>
          ) : (
            filtered.map(u => (
              <div
                key={u.id}
                onClick={() => setSelected(u)}
                style={{
                  padding: '0.75rem 1rem',
                  cursor: 'pointer',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: selected?.id === u.id ? 'var(--accent)' : 'white',
                  fontWeight: selected?.id === u.id ? 700 : 400,
                  color: selected?.id === u.id ? 'var(--primary)' : 'var(--text)',
                  transition: 'background 0.1s',
                }}
              >
                <span>{u.name}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: '#f0f0f0', borderRadius: '4px', padding: '2px 8px' }}>
                  {u.role === 'commander' ? 'מפקד' : 'חייל'}
                </span>
              </div>
            ))
          )}
        </div>

        <button
          className="btn-primary"
          style={{ width: '100%', padding: '0.75rem', fontSize: '1rem' }}
          disabled={!selected}
          onClick={handleEnter}
        >
          {selected ? `כניסה כ${selected.name}` : 'בחר שם כדי להיכנס'}
        </button>
      </div>
    </div>
  )
}
