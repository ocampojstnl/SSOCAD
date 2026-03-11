'use client'

import { useState } from 'react'
import { Unlock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { TempBanRecord } from '@/lib/storage'

export function TempBanList({ initialBans }: { initialBans: TempBanRecord[] }) {
  const [bans, setBans]         = useState(initialBans)
  const [unbanning, setUnbanning] = useState<string | null>(null)

  async function handleUnban(ip: string) {
    setUnbanning(ip)
    try {
      const res = await fetch(`/api/admin/ips/bans/${encodeURIComponent(ip)}`, { method: 'DELETE' })
      if (res.ok) setBans(prev => prev.filter(b => b.ip !== ip))
    } finally {
      setUnbanning(null)
    }
  }

  if (bans.length === 0) return <p className="text-sm text-muted-foreground">No active bans.</p>

  return (
    <div className="space-y-2">
      {bans.map(ban => {
        const expiresAt  = new Date(ban.expires_at)
        const bannedAt   = new Date(ban.banned_at)
        const hoursLeft  = Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 3600000))
        return (
          <div
            key={ban.id}
            className="flex items-start justify-between gap-4 rounded-md border border-red-900/40 bg-red-950/20 px-4 py-3"
          >
            <div className="min-w-0 space-y-1">
              <p className="font-mono text-sm font-medium text-red-300">{ban.ip}</p>
              <p className="text-xs text-muted-foreground">{ban.reason}</p>
              <p className="text-xs text-zinc-500">
                Banned {bannedAt.toLocaleString()} · expires in ~{hoursLeft}h
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 border-red-800 text-red-400 hover:bg-red-950 hover:text-red-300"
              disabled={unbanning === ban.ip}
              onClick={() => handleUnban(ban.ip)}
            >
              <Unlock className="mr-1 h-3 w-3" />
              {unbanning === ban.ip ? 'Unbanning…' : 'Unban'}
            </Button>
          </div>
        )
      })}
    </div>
  )
}
