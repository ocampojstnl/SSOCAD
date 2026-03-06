'use client'
import { useState } from 'react'
import { Loader2, LogIn, ExternalLink, Copy, Ban, CheckCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'

interface Site {
  site_id: string
  domain: string
  owner_email: string | null
  plugin_version: string
  registered_at: string
  last_seen: string
  blocked?: boolean
}

function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
}

export function SitesTable({ sites: initialSites }: { sites: Site[] }) {
  const [sites, setSites] = useState(initialSites)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [blockingId, setBlockingId] = useState<string | null>(null)
  const [pushUrl, setPushUrl] = useState<string | null>(null)

  async function handleToggleBlock(site: Site) {
    setBlockingId(site.site_id)
    try {
      const res = await fetch(`/api/admin/sites/${site.site_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocked: !site.blocked }),
      })
      if (res.ok) {
        setSites(prev => prev.map(s =>
          s.site_id === site.site_id ? { ...s, blocked: !s.blocked } : s
        ))
        toast.success(site.blocked ? 'Site unblocked' : 'Site blocked')
      } else {
        const { error } = await res.json().catch(() => ({}))
        toast.error(error ?? 'Failed to update site')
      }
    } finally {
      setBlockingId(null)
    }
  }

  async function handlePushLogin(site_id: string) {
    setLoadingId(site_id)
    try {
      const res = await fetch(`/api/admin/sites/${site_id}/push-login`)
      if (res.ok) {
        const { push_url } = await res.json()
        setPushUrl(push_url)
      } else {
        const { error } = await res.json().catch(() => ({}))
        toast.error(error ?? 'Failed to generate push-login URL')
      }
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Domain</TableHead>
            <TableHead>Owner</TableHead>
            <TableHead>Version</TableHead>
            <TableHead>Last Seen</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-[100px]">Block</TableHead>
            <TableHead className="w-[130px]">Push Login</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sites.map(site => {
            const days = daysSince(site.last_seen)
            const status = days <= 35 ? 'active' : days <= 90 ? 'idle' : 'stale'
            return (
              <TableRow key={site.site_id}>
                <TableCell className="font-mono text-xs">{site.domain}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {site.owner_email ?? '—'}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {site.plugin_version}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {days === 0 ? 'Today' : `${days}d ago`}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      site.blocked
                        ? 'destructive'
                        : status === 'active'
                        ? 'success'
                        : status === 'idle'
                        ? 'warning'
                        : 'destructive'
                    }
                  >
                    {site.blocked ? 'blocked' : status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={blockingId === site.site_id}
                    onClick={() => handleToggleBlock(site)}
                    className={`h-7 gap-1 text-xs border-zinc-700 ${site.blocked ? 'text-emerald-400' : 'text-red-400'}`}
                  >
                    {blockingId === site.site_id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : site.blocked ? (
                      <CheckCircle className="h-3 w-3" />
                    ) : (
                      <Ban className="h-3 w-3" />
                    )}
                    {site.blocked ? 'Unblock' : 'Block'}
                  </Button>
                </TableCell>
                <TableCell>
                  {site.owner_email ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={loadingId === site.site_id}
                      onClick={() => handlePushLogin(site.site_id)}
                      className="h-7 gap-1 text-xs border-zinc-700"
                    >
                      {loadingId === site.site_id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <LogIn className="h-3 w-3" />
                      )}
                      Push Login
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">No owner</span>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      <Dialog open={!!pushUrl} onOpenChange={() => setPushUrl(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-800 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Push Login URL</DialogTitle>
            <DialogDescription>
              Open this URL in your browser to log in instantly. Valid for 2 minutes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="break-all rounded-md border border-zinc-700 bg-zinc-800 p-3 font-mono text-xs leading-relaxed">
              {pushUrl}
            </div>
            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={() => {
                  navigator.clipboard.writeText(pushUrl ?? '')
                  toast.success('Copied to clipboard')
                }}
              >
                <Copy className="h-4 w-4" />
                Copy URL
              </Button>
              <Button
                variant="outline"
                className="border-zinc-700"
                onClick={() => window.open(pushUrl ?? '', '_blank')}
              >
                <ExternalLink className="h-4 w-4" />
                Open
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
