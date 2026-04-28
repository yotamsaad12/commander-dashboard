'use client'

import { useState, useEffect, useCallback } from 'react'
import { User, Constraint } from '@/lib/types'

const MONTH_NAMES_HE = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
]
const DAY_NAMES_HE = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳']

const MIN_YEAR = new Date().getFullYear()
const MIN_MONTH = new Date().getMonth()
const MAX_YEAR = 2026
const MAX_MONTH = 5 // June

interface DailyPresence { user_id: string; date: string; is_present: boolean }
interface SelectedDay { year: number; month: number; day: number }

function toDateStr(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}
function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}
function formatHebrewDate(year: number, month: number, day: number) {
  return new Date(year, month, day).toLocaleDateString('he-IL', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

export default function CommanderSoldiersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [constraints, setConstraints] = useState<Constraint[]>([])
  const [dailyPresence, setDailyPresence] = useState<DailyPresence[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [form, setForm] = useState({ name: '', role: 'soldier' as 'soldier' | 'commander' })
  const [submitting, setSubmitting] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)

  const now = new Date()
  const todayStr = toDateStr(now.getFullYear(), now.getMonth(), now.getDate())

  const [calYear, setCalYear] = useState(now.getFullYear())
  const [calMonth, setCalMonth] = useState(now.getMonth())
  const [selectedDay, setSelectedDay] = useState<SelectedDay | null>(null)

  const loadPresence = useCallback(async (year: number, month: number) => {
    const from = toDateStr(year, month, 1)
    const to = toDateStr(year, month, getDaysInMonth(year, month))
    const data = await fetch(`/api/daily-presence?from=${from}&to=${to}`).then(r => r.json())
    setDailyPresence(Array.isArray(data) ? data : [])
  }, [])

  const load = async () => {
    const [usersData, constraintsData] = await Promise.all([
      fetch('/api/users').then(r => r.json()),
      fetch('/api/constraints?status=approved').then(r => r.json()),
    ])
    setUsers(Array.isArray(usersData) ? usersData : [])
    setConstraints(Array.isArray(constraintsData) ? constraintsData : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])
  useEffect(() => { loadPresence(calYear, calMonth) }, [calYear, calMonth, loadPresence])

  // Presence logic — per day, per user
  const hasConstraintOnDay = (user: User, ds: string) =>
    constraints.some(c => c.user_id === user.id && c.start_date <= ds && ds <= c.end_date)

  const presenceOnDay = (user: User, ds: string): boolean => {
    const record = dailyPresence.find(p => p.user_id === user.id && p.date === ds)
    return record ? record.is_present : true // default: present
  }

  const isAbsentOnDay = (user: User, ds: string): boolean => {
    if (hasConstraintOnDay(user, ds)) return true
    return !presenceOnDay(user, ds)
  }

  const getConstraintOnDay = (user: User, ds: string) =>
    constraints.find(c => c.user_id === user.id && c.start_date <= ds && ds <= c.end_date)

  const toggleDayPresence = async (user: User, ds: string) => {
    if (hasConstraintOnDay(user, ds)) return // constraint is authoritative
    const currentlyPresent = presenceOnDay(user, ds)
    setToggling(user.id)
    await fetch('/api/daily-presence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, date: ds, is_present: !currentlyPresent }),
    })
    setToggling(null)
    await loadPresence(calYear, calMonth)
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
    setShowAddModal(false)
    setSubmitting(false)
    load()
  }

  if (loading) return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>טוען...</div>

  const totalCount = users.length
  const daysInMonth = getDaysInMonth(calYear, calMonth)
  const firstDay = getFirstDayOfMonth(calYear, calMonth)
  const canGoPrev = !(calYear === MIN_YEAR && calMonth === MIN_MONTH)
  const canGoNext = !(calYear === MAX_YEAR && calMonth === MAX_MONTH)

  const prevMonth = () => {
    if (!canGoPrev) return
    setSelectedDay(null)
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11) }
    else setCalMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (!canGoNext) return
    setSelectedDay(null)
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0) }
    else setCalMonth(m => m + 1)
  }

  const selDayStr = selectedDay ? toDateStr(selectedDay.year, selectedDay.month, selectedDay.day) : ''

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--sidebar)' }}>ניהול אנשי צוות</h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            לחץ על יום לצפייה ועריכת נוכחות
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowAddModal(true)}>+ הוסף איש צוות</button>
      </div>

      {/* ─── Calendar ─── */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
          <button onClick={prevMonth} disabled={!canGoPrev} style={{ background: 'none', border: 'none', cursor: canGoPrev ? 'pointer' : 'default', fontSize: '1.4rem', color: canGoPrev ? 'var(--primary)' : 'var(--border)', lineHeight: 1, padding: '0.1rem 0.4rem' }}>›</button>
          <h2 style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--sidebar)', margin: 0 }}>
            {MONTH_NAMES_HE[calMonth]} {calYear}
          </h2>
          <button onClick={nextMonth} disabled={!canGoNext} style={{ background: 'none', border: 'none', cursor: canGoNext ? 'pointer' : 'default', fontSize: '1.4rem', color: canGoNext ? 'var(--primary)' : 'var(--border)', lineHeight: 1, padding: '0.1rem 0.4rem' }}>‹</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: '4px' }}>
          {DAY_NAMES_HE.map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', padding: '0.2rem 0' }}>{d}</div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '3px' }}>
          {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
            const ds = toDateStr(calYear, calMonth, day)
            const isPast = ds < todayStr
            const absent = users.filter(u => isAbsentOnDay(u, ds)).length
            const present = totalCount - absent
            const isToday = ds === todayStr
            const isSel = selectedDay?.day === day && selectedDay?.month === calMonth && selectedDay?.year === calYear

            let bg = '#edf7ee'
            if (absent > 0 && absent < totalCount / 2) bg = '#fffbec'
            else if (absent > 0 && absent >= totalCount / 2) bg = '#fff0f0'
            if (isPast) bg = '#f5f5f5'

            return (
              <div
                key={day}
                onClick={() => !isPast && setSelectedDay(isSel ? null : { year: calYear, month: calMonth, day })}
                style={{
                  background: isSel ? 'var(--primary)' : (isToday ? '#c8e6c9' : bg),
                  borderRadius: '7px',
                  padding: '0.3rem 0.15rem',
                  cursor: isPast ? 'default' : 'pointer',
                  border: isToday && !isSel ? '2px solid var(--primary)' : isSel ? '2px solid var(--primary-hover)' : '1.5px solid transparent',
                  minHeight: '54px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
                  userSelect: 'none', transition: 'all 0.12s',
                  opacity: isPast ? 0.45 : 1,
                }}
              >
                <span style={{ fontWeight: 700, fontSize: '0.82rem', color: isSel ? 'white' : isToday ? 'var(--primary)' : isPast ? '#999' : 'var(--text)' }}>
                  {day}
                </span>
                {!isPast && (
                  <>
                    <span style={{ fontSize: '0.62rem', fontWeight: 600, color: isSel ? 'rgba(255,255,255,0.92)' : '#2e7d32' }}>✓ {present}</span>
                    <span style={{ fontSize: '0.62rem', fontWeight: 600, color: isSel ? 'rgba(255,255,255,0.85)' : '#c62828' }}>✗ {absent}</span>
                  </>
                )}
              </div>
            )
          })}
        </div>

        <div style={{ display: 'flex', gap: '1.25rem', marginTop: '0.85rem', fontSize: '0.73rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
          <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: '#edf7ee', border: '1px solid #a5d6a7', marginLeft: 4 }} />כולם נמצאים</span>
          <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: '#fffbec', border: '1px solid #ffe082', marginLeft: 4 }} />חלק חסרים</span>
          <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: '#fff0f0', border: '1px solid #ef9a9a', marginLeft: 4 }} />מחצית+ חסרים</span>
        </div>
      </div>

      {/* ─── Selected day detail ─── */}
      {selectedDay && (
        <div className="card" style={{ borderRight: '4px solid var(--primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--sidebar)' }}>
                {formatHebrewDate(selectedDay.year, selectedDay.month, selectedDay.day)}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                {users.filter(u => !isAbsentOnDay(u, selDayStr)).length} נמצאים · {users.filter(u => isAbsentOnDay(u, selDayStr)).length} חסרים
              </div>
            </div>
            <button onClick={() => setSelectedDay(null)} style={{ background: 'none', border: 'none', fontSize: '1.1rem', cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
          </div>

          <div className="table-wrapper"><table className="table-base">
            <thead>
              <tr>
                <th>שם</th>
                <th>תפקיד</th>
                <th style={{ textAlign: 'center' }}>סיבת היעדרות</th>
                <th style={{ textAlign: 'center' }}>נוכחות</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                const constraint = getConstraintOnDay(u, selDayStr)
                const isPresent = presenceOnDay(u, selDayStr)
                const manualAbsent = !constraint && !isPresent
                return (
                  <tr key={u.id} style={{ background: isAbsentOnDay(u, selDayStr) ? '#fff8f0' : undefined }}>
                    <td style={{ fontWeight: 600 }}>{u.name}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {u.role === 'commander' ? 'מפקד' : 'חייל'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {constraint ? (
                        <span title={constraint.reason} style={{ display: 'inline-block', background: '#fff3cd', color: '#856404', border: '1px solid #ffc107', borderRadius: '20px', padding: '2px 8px', fontSize: '0.72rem', fontWeight: 600, cursor: 'help' }}>
                          אילוץ
                        </span>
                      ) : manualAbsent ? (
                        <span style={{ display: 'inline-block', background: '#f8d7da', color: '#721c24', border: '1px solid #dc3545', borderRadius: '20px', padding: '2px 8px', fontSize: '0.72rem', fontWeight: 600 }}>
                          ידני
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {constraint ? (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>לא ניתן לשינוי</span>
                      ) : (
                        <button
                          onClick={() => toggleDayPresence(u, selDayStr)}
                          disabled={toggling === u.id}
                          style={{
                            border: 'none', borderRadius: '20px', padding: '0.25rem 0.7rem',
                            cursor: toggling === u.id ? 'wait' : 'pointer',
                            fontWeight: 700, fontSize: '0.78rem',
                            background: isPresent ? '#d4edda' : '#f8d7da',
                            color: isPresent ? '#155724' : '#721c24',
                            minWidth: '76px',
                          }}
                        >
                          {toggling === u.id ? '...' : isPresent ? '✓ נמצא' : '✗ לא נמצא'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table></div>
        </div>
      )}

      {/* ─── Add member modal ─── */}
      {showAddModal && (
        <div className="modal-backdrop" onClick={() => setShowAddModal(false)}>
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
              <button className="btn-secondary" onClick={() => setShowAddModal(false)}>ביטול</button>
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
