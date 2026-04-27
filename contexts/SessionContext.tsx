'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { getSession, clearSession, Session } from '@/lib/session'

interface SessionContextType {
  session: Session | null
  loading: boolean
  logout: () => void
  refresh: () => void
}

const SessionContext = createContext<SessionContextType>({
  session: null,
  loading: true,
  logout: () => {},
  refresh: () => {},
})

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = () => {
    setSession(getSession())
    setLoading(false)
  }

  const logout = () => {
    clearSession()
    setSession(null)
    window.location.href = '/'
  }

  useEffect(() => {
    refresh()
  }, [])

  return (
    <SessionContext.Provider value={{ session, loading, logout, refresh }}>
      {children}
    </SessionContext.Provider>
  )
}

export const useSession = () => useContext(SessionContext)
