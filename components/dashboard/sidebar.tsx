'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Lock, Mail, Shield, Globe, Settings, LogOut, LayoutDashboard, Puzzle, Bell } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useTransition, useEffect, useState } from 'react'

const nav = [
  { href: '/dashboard',            label: 'Overview',      icon: LayoutDashboard },
  { href: '/dashboard/auth-codes', label: 'Auth Codes',    icon: Bell, badge: true },
  { href: '/dashboard/emails',     label: 'Emails',        icon: Mail },
  { href: '/dashboard/ips',        label: 'IP Lists',      icon: Shield },
  { href: '/dashboard/sites',      label: 'Sites',         icon: Globe },
  { href: '/dashboard/plugin',     label: 'Plugin & Keys', icon: Puzzle },
  { href: '/dashboard/settings',   label: 'Settings',      icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()
  const [isPending, startTransition] = useTransition()
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function fetchCount() {
      try {
        const res = await fetch('/api/admin/auth-codes')
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled) setPendingCount(data.pendingCount ?? 0)
      } catch { /* silent */ }
    }
    fetchCount()
    const id = setInterval(fetchCount, 30_000)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  function handleLogout() {
    startTransition(async () => {
      await fetch('/api/auth/logout', { method: 'POST' })
      toast.success('Signed out')
      router.push('/login')
    })
  }

  return (
    <aside className="flex h-screen w-56 flex-col border-r border-zinc-800 bg-zinc-900">
      {/* Logo */}
      <div className="flex items-center gap-3 border-b border-zinc-800 px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800 ring-1 ring-zinc-700">
          <Lock className="h-4 w-4 text-sky-400" />
        </div>
        <div>
          <p className="text-sm font-semibold leading-none text-foreground">Cad Dev SSO</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Admin</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 p-3">
        {nav.map(({ href, label, icon: Icon, badge }) => {
          const active = pathname === href
          const count  = badge ? pendingCount : 0
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                active
                  ? 'bg-zinc-800 text-foreground'
                  : 'text-muted-foreground hover:bg-zinc-800/60 hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              <span className="flex-1">{label}</span>
              {count > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-black">
                  {count}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <div className="border-t border-zinc-800 p-3">
        <button
          onClick={handleLogout}
          disabled={isPending}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-zinc-800/60 hover:text-foreground disabled:opacity-50"
        >
          <LogOut className="h-4 w-4 flex-shrink-0" />
          Sign Out
        </button>
      </div>
    </aside>
  )
}
