import type { Metadata } from 'next'
import { Toaster } from 'sonner'
import './globals.css'

export const metadata: Metadata = {
  title:       'Cad Dev SSO',
  description: 'Identity Provider for WordPress developer access',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background antialiased">
        {children}
        <Toaster position="top-right" theme="dark" richColors />
      </body>
    </html>
  )
}
