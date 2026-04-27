import type { Metadata } from 'next'
import './globals.css'
import { SessionProvider } from '@/contexts/SessionContext'

export const metadata: Metadata = {
  title: 'מערכת ניהול מילואים',
  description: 'מערכת פיקוד לניהול ציוד, אילוצים ושמירות',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  )
}
