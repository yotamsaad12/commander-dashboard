'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from '@/contexts/SessionContext'
import NavBar from '@/components/NavBar'

const navItems = [
  { href: '/soldier/equipment', label: 'ציוד', icon: '🎒' },
  { href: '/soldier/constraints', label: 'אילוצים', icon: '📅' },
  { href: '/soldier/guard', label: 'שמירה', icon: '🛡️' },
]

export default function SoldierLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { session, loading } = useSession()

  useEffect(() => {
    if (!loading && !session) router.replace('/')
    if (!loading && session?.role === 'commander') router.replace('/commander/equipment')
  }, [session, loading, router])

  if (loading || !session) return null

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <NavBar items={navItems} />
      <main style={{ flex: 1, maxWidth: '1000px', width: '100%', margin: '0 auto', padding: '1.5rem 1.25rem' }}>
        {children}
      </main>
    </div>
  )
}
