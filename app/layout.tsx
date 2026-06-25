import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'SphereSDS',
  description: 'Africa-first learning and assessment platform',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
