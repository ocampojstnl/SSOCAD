'use client'
import { useState, useEffect } from 'react'
import {
  Loader2, LogIn, ExternalLink, Copy, Ban, CheckCircle, ShieldOff,
  Users, LayoutList, LayoutGrid, RefreshCw, Clock, LogOut, PowerOff,
} from 'lucide-react'
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

interface LoginSession {
  id: string
  site_id: string
  email: string
  login_at: string
  logout_at?: string
  status: 'active' | 'signed_out'
}

type ViewMode = 'table' | 'grid'

function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function siteStatus(site: Site) {
  if (site.blocked) return 'blocked'
  const days = daysSince(site.last_seen)
  if (days <= 35) return 'active'
  if (days <= 90) return 'idle'
  return 'stale'
}

function StatusBadge({ site }: { site: Site }) {
  const s = siteStatus(site)
  return (
    <Badge
      variant={
        s === 'blocked' ? 'destructive'
          : s === 'active' ? 'success'
          : s === 'idle' ? 'warning'
          : 'destructive'
      }
    >
      {s}
    </Badge>
  )
}

export function SitesTable({ sites: initialSites }: { sites: Site[] }) {
  const [sites, setSites] = useState(initialSites)
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [blockingId, setBlockingId] = useState<string | null>(null)
  const [resetingId, setResetingId] = useState<string | null>(null)
  const [pushUrl, setPushUrl] = useState<string | null>(null)

  // Sessions dialog state
  const [sessionSite, setSessionSite] = useState<Site | null>(null)
  const [sessions, setSessions] = useState<LoginSession[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [activeCounts, setActiveCounts] = useState<Record<string, number>>({})
  const [forcingOut, setForcingOut] = useState<string | null>(null) // session id being forced out

  // Restore view preference
  useEffect(() => {
    const saved = localStorage.getItem('cad_dev_sites_view') as ViewMode | null
    if (saved === 'table' || saved === 'grid') setViewMode(saved)
  }, [])

  function switchView(mode: ViewMode) {
    setViewMode(mode)
    localStorage.setItem('cad_dev_sites_view', mode)
  }

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

  async function handleResetTrust(site_id: string) {
    setResetingId(site_id)
    try {
      const res = await fetch(`/api/admin/sites/${site_id}/reset-trust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        toast.success(`Layer 1 trust reset — ${data.deleted ?? 0} record(s) cleared`)
      } else {
        toast.error(data.error ?? 'Failed to reset trust')
      }
    } finally {
      setResetingId(null)
    }
  }

  async function openSessions(site: Site) {
    setSessionSite(site)
    setSessions([])
    setSessionsLoading(true)
    try {
      const res = await fetch(`/api/admin/sites/${site.site_id}/sessions`)
      if (res.ok) {
        const { sessions: data } = await res.json()
        setSessions(data)
        setActiveCounts(prev => ({
          ...prev,
          [site.site_id]: data.filter((s: LoginSession) => s.status === 'active').length,
        }))
      }
    } finally {
      setSessionsLoading(false)
    }
  }

  async function handleForceLogout(session: LoginSession) {
    if (!sessionSite) return
    setForcingOut(session.id)
    try {
      const res = await fetch(`/api/admin/sites/${sessionSite.site_id}/force-logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: session.email }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        // Update session in local state immediately
        setSessions(prev => prev.map(s =>
          s.id === session.id
            ? { ...s, status: 'signed_out', logout_at: new Date().toISOString() }
            : s
        ))
        setActiveCounts(prev => ({
          ...prev,
          [sessionSite.site_id]: Math.max(0, (prev[sessionSite.site_id] ?? 1) - 1),
        }))
        toast.success(`${session.email} has been signed out${data.wp_notified ? '' : ' (plugin unreachable — session invalidated in web app)'}`)
      } else {
        toast.error(data.error ?? 'Failed to force logout')
      }
    } finally {
      setForcingOut(null)
    }
  }

  // ── Action buttons (shared between table and grid) ──────────────────────────

  function ActionButtons({ site }: { site: Site }) {
    return (
      <div className="flex flex-wrap gap-1.5">
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
        ) : null}

        <Button
          size="sm"
          variant="outline"
          disabled={resetingId === site.site_id}
          onClick={() => handleResetTrust(site.site_id)}
          className="h-7 gap-1 text-xs border-zinc-700 text-amber-400"
        >
          {resetingId === site.site_id ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <ShieldOff className="h-3 w-3" />
          )}
          Reset Trust
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={() => openSessions(site)}
          className="h-7 gap-1 text-xs border-zinc-700 text-sky-400"
        >
          <Users className="h-3 w-3" />
          Activity
          {activeCounts[site.site_id] != null && (
            <span className="ml-0.5 rounded-full bg-sky-400/20 px-1.5 text-[10px] font-medium text-sky-400">
              {activeCounts[site.site_id]}
            </span>
          )}
        </Button>
      </div>
    )
  }

  // ── View toggle header ───────────────────────────────────────────────────────

  const ViewToggle = (
    <div className="flex items-center gap-1 border border-zinc-700 rounded-md p-0.5">
      <button
        onClick={() => switchView('table')}
        className={`rounded p-1.5 transition-colors ${viewMode === 'table' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
        title="Table view"
      >
        <LayoutList className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => switchView('grid')}
        className={`rounded p-1.5 transition-colors ${viewMode === 'grid' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
        title="Grid view"
      >
        <LayoutGrid className="h-3.5 w-3.5" />
      </button>
    </div>
  )

  return (
    <>
      {/* View toggle — top right of the list */}
      <div className="flex justify-end px-6 pt-4 pb-2">
        {ViewToggle}
      </div>

      {/* ── TABLE VIEW ────────────────────────────────────────────────────── */}
      {viewMode === 'table' && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Domain</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Version</TableHead>
              <TableHead>Last Seen</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sites.map(site => (
              <TableRow key={site.site_id}>
                <TableCell className="font-mono text-xs">{site.domain}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {site.owner_email ?? '—'}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {site.plugin_version}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {daysSince(site.last_seen) === 0 ? 'Today' : `${daysSince(site.last_seen)}d ago`}
                </TableCell>
                <TableCell>
                  <StatusBadge site={site} />
                </TableCell>
                <TableCell>
                  <ActionButtons site={site} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* ── GRID VIEW ─────────────────────────────────────────────────────── */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 xl:grid-cols-3">
          {sites.map(site => (
            <div
              key={site.site_id}
              className="flex flex-col gap-3 rounded-lg border border-zinc-700 bg-zinc-800/50 p-4"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <a
                    href={site.domain}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 font-mono text-xs text-white hover:underline truncate"
                  >
                    {site.domain}
                    <ExternalLink className="h-3 w-3 shrink-0 text-zinc-500" />
                  </a>
                  <p className="mt-0.5 text-xs text-zinc-500">{site.owner_email ?? 'No owner'}</p>
                </div>
                <StatusBadge site={site} />
              </div>

              {/* Meta */}
              <div className="flex gap-4 text-[11px] text-zinc-500">
                <span>v{site.plugin_version}</span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {daysSince(site.last_seen) === 0 ? 'Today' : `${daysSince(site.last_seen)}d ago`}
                </span>
                {activeCounts[site.site_id] != null && (
                  <span className="flex items-center gap-1 text-sky-400">
                    <Users className="h-3 w-3" />
                    {activeCounts[site.site_id]} active
                  </span>
                )}
              </div>

              {/* Actions */}
              <ActionButtons site={site} />
            </div>
          ))}
        </div>
      )}

      {/* ── PUSH LOGIN DIALOG ─────────────────────────────────────────────── */}
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

      {/* ── SESSIONS ACTIVITY DIALOG ──────────────────────────────────────── */}
      <Dialog open={!!sessionSite} onOpenChange={open => { if (!open) setSessionSite(null) }}>
        <DialogContent className="bg-zinc-900 border-zinc-800 sm:max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-4 w-4 text-sky-400" />
              Login Activity
            </DialogTitle>
            <DialogDescription className="font-mono text-xs">
              {sessionSite?.domain}
            </DialogDescription>
          </DialogHeader>

          {/* Refresh + summary */}
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>
              {sessions.filter(s => s.status === 'active').length} active ·{' '}
              {sessions.length} total
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1 text-xs text-zinc-400"
              disabled={sessionsLoading}
              onClick={() => sessionSite && openSessions(sessionSite)}
            >
              <RefreshCw className={`h-3 w-3 ${sessionsLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {/* Sessions list */}
          <div className="overflow-y-auto flex-1 rounded-md border border-zinc-800">
            {sessionsLoading ? (
              <div className="flex items-center justify-center py-12 text-zinc-500 text-sm gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading sessions…
              </div>
            ) : sessions.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-zinc-500 text-sm">
                No login activity recorded yet.
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-zinc-900 border-b border-zinc-800">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-medium text-zinc-400">User</th>
                    <th className="px-4 py-2.5 text-left font-medium text-zinc-400">Logged In</th>
                    <th className="px-4 py-2.5 text-left font-medium text-zinc-400">Status</th>
                    <th className="px-4 py-2.5 text-left font-medium text-zinc-400">Logged Out</th>
                    <th className="px-4 py-2.5 text-left font-medium text-zinc-400" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {sessions.map(s => (
                    <tr key={s.id} className="hover:bg-zinc-800/40 transition-colors">
                      <td className="px-4 py-2.5 text-zinc-300">{s.email}</td>
                      <td className="px-4 py-2.5 text-zinc-500" title={s.login_at}>
                        {relativeTime(s.login_at)}
                      </td>
                      <td className="px-4 py-2.5">
                        {s.status === 'active' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-zinc-700/50 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
                            <LogOut className="h-2.5 w-2.5" />
                            Signed out
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-zinc-500">
                        {s.logout_at ? (
                          <span title={s.logout_at}>{relativeTime(s.logout_at)}</span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {s.status === 'active' && (
                          <button
                            disabled={forcingOut === s.id}
                            onClick={() => handleForceLogout(s)}
                            className="inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium text-red-400 border border-red-400/30 hover:bg-red-400/10 disabled:opacity-50 transition-colors"
                            title="Force sign out this user"
                          >
                            {forcingOut === s.id ? (
                              <Loader2 className="h-2.5 w-2.5 animate-spin" />
                            ) : (
                              <PowerOff className="h-2.5 w-2.5" />
                            )}
                            Force logout
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
