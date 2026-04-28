'use client'

import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { Equipment, EquipmentRequest, User } from '@/lib/types'
import StatusBadge from '@/components/StatusBadge'

const EQUIPMENT_TYPES = [
  'משקפת', 'פא"ק', 'שח"מ', 'קשר', 'אולר', 'נשק',
  'כוונת', 'קסדה', 'מאג', 'מטול', 'רימונים',
]
const SCOPE_SUBTYPES = ['מאפרו', 'אקילה', 'טריג\'']

const EXTRA_ITEMS: Record<string, { label: string; type: string }> = {
  'מטול': { label: 'זאבון', type: 'זאבון' },
  'מאג':  { label: 'קנה ספר', type: 'קנה ספר' },
}

interface EquipmentForm {
  user_id: string
  type: string
  subtype: string
  serial_number: string
  extra_serial: string
  notes: string
}

const emptyForm = (): EquipmentForm => ({
  user_id: '', type: '', subtype: '', serial_number: '', extra_serial: '', notes: '',
})

export default function CommanderEquipmentPage() {
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [requests, setRequests] = useState<EquipmentRequest[]>([])
  const [soldiers, setSoldiers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<Equipment | null>(null)
  const [form, setForm] = useState<EquipmentForm>(emptyForm())
  const [submitting, setSubmitting] = useState(false)
  const [filterSoldier, setFilterSoldier] = useState('')

  const load = async () => {
    const [eqRes, reqRes, soldiersRes] = await Promise.all([
      fetch('/api/equipment').then(r => r.json()),
      fetch('/api/equipment-requests').then(r => r.json()),
      fetch('/api/users').then(r => r.json()),
    ])
    setEquipment(Array.isArray(eqRes) ? eqRes : [])
    setRequests(Array.isArray(reqRes) ? reqRes : [])
    setSoldiers(Array.isArray(soldiersRes) ? soldiersRes : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openAdd = () => { setEditItem(null); setForm(emptyForm()); setShowModal(true) }

  const openEdit = (eq: Equipment) => {
    setEditItem(eq)
    setForm({ ...emptyForm(), user_id: eq.user_id, type: eq.type, serial_number: eq.serial_number || '', notes: eq.notes || '' })
    setShowModal(true)
  }

  const isScope   = form.type === 'כוונת'
  const isGrenades = form.type === 'רימונים'
  const extraItem = EXTRA_ITEMS[form.type]

  const save = async () => {
    if (!form.user_id || !form.type) return
    setSubmitting(true)

    const mainType = isScope && form.subtype ? `כוונת ${form.subtype}` : form.type

    if (editItem) {
      await fetch('/api/equipment', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editItem.id, type: mainType, serial_number: form.serial_number || null, notes: form.notes }),
      })
    } else {
      await fetch('/api/equipment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: form.user_id, type: mainType, serial_number: form.serial_number || null, notes: form.notes }),
      })
      if (extraItem) {
        await fetch('/api/equipment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: form.user_id, type: extraItem.type, serial_number: form.extra_serial || null, notes: '' }),
        })
      }
    }

    setShowModal(false)
    setSubmitting(false)
    load()
  }

  const deleteEq = async (id: string) => {
    if (!confirm('האם למחוק פריט זה?')) return
    await fetch(`/api/equipment?id=${id}`, { method: 'DELETE' })
    load()
  }

  const updateRequestStatus = async (id: string, status: string) => {
    await fetch('/api/equipment-requests', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    load()
  }

  const canSave = () => {
    if (!form.user_id || !form.type) return false
    if (isScope && !form.subtype) return false
    if (extraItem && !form.extra_serial) return false
    return true
  }

  const exportToExcel = () => {
    // Collect all unique equipment types from actual data, preserving logical order
    const typeOrder = [...EQUIPMENT_TYPES, 'זאבון', 'קנה ספר']
    const usedTypes = typeOrder.filter(t => equipment.some(e => e.type === t))
    // Add any types not in the predefined list (e.g. כוונת מאפרו)
    equipment.forEach(e => { if (!usedTypes.includes(e.type)) usedTypes.push(e.type) })

    const rows = soldiers.map(soldier => {
      const row: Record<string, string> = { 'שם': soldier.name }
      usedTypes.forEach(type => {
        const items = equipment.filter(e => e.user_id === soldier.id && e.type === type)
        row[type] = items.map(e => e.serial_number || '').filter(Boolean).join(', ')
      })
      return row
    })

    const ws = XLSX.utils.json_to_sheet(rows, { header: ['שם', ...usedTypes] })

    // Column widths
    ws['!cols'] = [{ wch: 16 }, ...usedTypes.map(() => ({ wch: 18 }))]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'ציוד')
    XLSX.writeFile(wb, 'רשימת_ציוד.xlsx')
  }

  if (loading) return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>טוען...</div>

  const filtered = filterSoldier ? equipment.filter(e => e.user_id === filterSoldier) : equipment
  const pending = requests.filter(r => r.status === 'pending')

  return (
    <div>
      <div className="page-header">
        <h1 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--sidebar)' }}>ניהול ציוד</h1>
        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <button className="btn-secondary" onClick={exportToExcel}>⬇ ייצא לאקסל</button>
          <button className="btn-primary" onClick={openAdd}>+ שייך ציוד לחייל</button>
        </div>
      </div>

      {pending.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem', borderRight: '4px solid var(--warning)' }}>
          <h2 className="section-title">בקשות ציוד ממתינות ({pending.length})</h2>
          <div className="table-wrapper"><table className="table-base">
            <thead>
              <tr><th>חייל</th><th>תיאור</th><th>תאריך</th><th>פעולות</th></tr>
            </thead>
            <tbody>
              {pending.map(r => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600 }}>{r.users?.name}</td>
                  <td>{r.description}</td>
                  <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{new Date(r.created_at).toLocaleDateString('he-IL')}</td>
                  <td style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn-primary" style={{ padding: '0.25rem 0.65rem', fontSize: '0.8rem' }} onClick={() => updateRequestStatus(r.id, 'approved')}>אשר</button>
                    <button className="btn-danger" style={{ padding: '0.25rem 0.65rem', fontSize: '0.8rem' }} onClick={() => updateRequestStatus(r.id, 'rejected')}>דחה</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 className="section-title" style={{ margin: 0 }}>מלאי ציוד</h2>
          <select className="input" style={{ width: 'auto' }} value={filterSoldier} onChange={e => setFilterSoldier(e.target.value)}>
            <option value="">כל החיילים</option>
            {soldiers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">אין ציוד להצגה</div>
        ) : (
          <div className="table-wrapper"><table className="table-base">
            <thead>
              <tr><th>חייל</th><th>סוג ציוד</th><th>מספר סידורי</th><th>הערות</th><th>פעולות</th></tr>
            </thead>
            <tbody>
              {filtered.map(eq => (
                <tr key={eq.id}>
                  <td style={{ fontWeight: 600 }}>{eq.users?.name}</td>
                  <td>{eq.type}</td>
                  <td style={{ fontFamily: 'monospace', direction: 'ltr', textAlign: 'left' }}>{eq.serial_number || '—'}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{eq.notes || '—'}</td>
                  <td style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn-secondary" style={{ padding: '0.25rem 0.65rem', fontSize: '0.8rem' }} onClick={() => openEdit(eq)}>ערוך</button>
                    <button className="btn-danger" style={{ padding: '0.25rem 0.65rem', fontSize: '0.8rem' }} onClick={() => deleteEq(eq.id)}>מחק</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal" style={{ maxWidth: '520px' }} onClick={e => e.stopPropagation()}>
            <h2>{editItem ? 'עריכת פריט ציוד' : 'שיוך ציוד לחייל'}</h2>

            {/* Soldier */}
            <div style={{ marginBottom: '0.75rem' }}>
              <label className="label">חייל</label>
              <select className="input" value={form.user_id}
                onChange={e => setForm(f => ({ ...f, user_id: e.target.value }))}
                disabled={!!editItem}>
                <option value="">— בחר חייל —</option>
                {soldiers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            {/* Equipment type */}
            <div style={{ marginBottom: '0.75rem' }}>
              <label className="label">סוג ציוד</label>
              <select className="input" value={form.type}
                onChange={e => setForm(f => ({ ...emptyForm(), user_id: f.user_id, type: e.target.value }))}>
                <option value="">— בחר סוג ציוד —</option>
                {EQUIPMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            {/* כוונת → sub-type */}
            {isScope && (
              <div style={{ marginBottom: '0.75rem', padding: '0.75rem', background: 'var(--accent)', borderRadius: '6px' }}>
                <label className="label">סוג כוונת <span style={{ color: 'red' }}>*</span></label>
                <div style={{ display: 'flex', gap: '0.6rem' }}>
                  {SCOPE_SUBTYPES.map(st => (
                    <label key={st} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer', fontWeight: form.subtype === st ? 700 : 400 }}>
                      <input type="radio" name="subtype" value={st}
                        checked={form.subtype === st}
                        onChange={() => setForm(f => ({ ...f, subtype: st }))} />
                      {st}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Serial number — for all types including grenades */}
            <div style={{ marginBottom: '0.75rem' }}>
              <label className="label">
                {isGrenades ? 'מספרים סיריאליים' : 'מספר סידורי'}
                <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginRight: '0.35rem' }}>(אופציונלי)</span>
              </label>
              <input
                className="input"
                placeholder={isGrenades ? 'לדוגמא: 1, 2, 3' : 'מספר סידורי...'}
                value={form.serial_number}
                onChange={e => setForm(f => ({ ...f, serial_number: e.target.value }))}
                style={{ direction: 'ltr', textAlign: 'left' }}
              />
              {isGrenades && (
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                  ניתן להזין מספרים מרובים מופרדים בפסיק
                </p>
              )}
            </div>

            {/* מטול / מאג → companion item */}
            {extraItem && !editItem && (
              <div style={{ marginBottom: '0.75rem', padding: '0.75rem', background: '#fff8e1', border: '1px solid #ffc107', borderRadius: '6px' }}>
                <label className="label" style={{ color: '#856404' }}>
                  {extraItem.label} <span style={{ color: 'red' }}>* חובה</span>
                </label>
                <input className="input" placeholder={`מספר סידורי ${extraItem.label}...`}
                  value={form.extra_serial}
                  onChange={e => setForm(f => ({ ...f, extra_serial: e.target.value }))}
                  style={{ direction: 'ltr', textAlign: 'left' }} />
                <p style={{ fontSize: '0.78rem', color: '#856404', marginTop: '0.35rem' }}>
                  יתווסף אוטומטית כפריט נפרד
                </p>
              </div>
            )}

            {/* Notes */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label className="label">הערות <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(אופציונלי)</span></label>
              <input className="input" placeholder="הערות נוספות..." value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => setShowModal(false)}>ביטול</button>
              <button className="btn-primary" disabled={!canSave() || submitting} onClick={save}>
                {submitting ? 'שומר...' : editItem ? 'עדכן' : (extraItem ? `שייך (${form.type} + ${extraItem.label})` : 'שייך')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
