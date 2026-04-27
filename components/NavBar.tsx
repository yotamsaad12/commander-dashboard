'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from '@/contexts/SessionContext'

interface NavItem { href: string; label: string; icon: string }
interface NavBarProps { items: NavItem[] }

export default function NavBar({ items }: NavBarProps) {
  const pathname = usePathname()
  const { session, logout } = useSession()

  return (
    <>
      {/* ── Top bar ── */}
      <header style={{ background: 'var(--sidebar)', color: 'white', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '52px' }}>

          {/* Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800, fontSize: '1rem' }}>
            <span>🪖</span>
            <span>מערכת מילואים</span>
            {session?.role === 'commander' && (
              <span style={{ fontSize: '0.68rem', background: '#c0392b', borderRadius: '4px', padding: '1px 6px' }}>מפקד</span>
            )}
          </div>

          {/* Desktop nav links */}
          <nav className="top-nav-links" style={{ display: 'flex', gap: '0.2rem', alignItems: 'center' }}>
            {items.map(item => {
              const active = pathname === item.href
              return (
                <Link key={item.href} href={item.href} style={{
                  display: 'flex', alignItems: 'center', gap: '0.35rem',
                  padding: '0.4rem 0.85rem', borderRadius: '6px',
                  textDecoration: 'none', fontSize: '0.875rem',
                  fontWeight: active ? 700 : 500,
                  color: active ? 'white' : 'rgba(255,255,255,0.7)',
                  background: active ? 'rgba(255,255,255,0.15)' : 'transparent',
                }}>
                  <span>{item.icon}</span><span>{item.label}</span>
                </Link>
              )
            })}
          </nav>

          {/* User + logout */}
          <div className="top-bar-user" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.85rem' }}>
            <span style={{ color: 'rgba(255,255,255,0.8)' }}>{session?.name}</span>
            <button onClick={logout} style={{
              background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white',
              borderRadius: '5px', padding: '0.3rem 0.7rem', cursor: 'pointer', fontSize: '0.8rem',
            }}>יציאה</button>
          </div>
        </div>
      </header>

      {/* ── Mobile bottom navigation ── */}
      <nav className="bottom-nav">
        {items.map(item => (
          <Link key={item.href} href={item.href} className={pathname === item.href ? 'active' : ''}>
            <span className="icon">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
    </>
  )
}
