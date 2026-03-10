'use client'
import { useState, useEffect } from 'react'
import {
  Loader2, LogIn, ExternalLink, Copy, Ban, CheckCircle, ShieldOff,
  Users, LayoutList, LayoutGrid, RefreshCw, Clock, LogOut, PowerOff,
  Pencil, Eye, EyeOff, Key, Plus, KeyRound, UserCheck, Trash2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  project_key?: string
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

function truncateKey(key: string) {
  return key.slice(0, 12) + '…' + key.slice(-4)
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
  const [forcingOut, setForcingOut] = useState<string | null>(null)

  // Access (per-site emails) dialog
  const [accessSite, setAccessSite] = useState<Site | null>(null)
  const [accessEmails, setAccessEmails] = useState<string[]>([])
  const [accessLoading, setAccessLoading] = useState(false)
  const [newAccessEmail, setNewAccessEmail] = useState('')
  const [addingEmail, setAddingEmail] = useState(false)
  const [removingEmail, setRemovingEmail] = useState<string | null>(null)
  const [globalEmails, setGlobalEmails] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)

  // Register new site dialog
  const [registerOpen, setRegisterOpen] = useState(false)
  const [registerDomain, setRegisterDomain] = useState('')
  const [registering, setRegistering] = useState(false)
  const [newSite, setNewSite] = useState<Site | null>(null)
  const [newKeyVisible, setNewKeyVisible] = useState(false)

  // Edit domain dialog
  const [editSite, setEditSite] = useState<Site | null>(null)
  const [editDomain, setEditDomain] = useState('')
  const [saving, setSaving] = useState(false)

  // View / Generate project key
  const [viewKeySite, setViewKeySite] = useState<Site | null>(null)
  const [keyVisible, setKeyVisible] = useState(false)
  const [generatingKeyId, setGeneratingKeyId] = useState<string | null>(null)

  // Restore view preference
  useEffect(() => {
    const saved = localStorage.getItem('cad_dev_sites_view') as ViewMode | null
    if (saved === 'table' || saved === 'grid') setViewMode(saved)
  }, [])

  function switchView(mode: ViewMode) {
    setViewMode(mode)
    localStorage.setItem('cad_dev_sites_view', mode)
  }

  // ── Register new site ────────────────────────────────────────────────────────

  async function handleRegister() {
    const domain = registerDomain.trim()
    if (!domain) return
    setRegistering(true)
    try {
      const res = await fetch('/api/admin/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        const created: Site = data.site
        setSites(prev => [created, ...prev])
        setRegisterDomain('')
        setNewSite(created)
        setNewKeyVisible(false)
        toast.success('Site registered')
      } else {
        toast.error(data.error ?? 'Failed to register site')
      }
    } finally {
      setRegistering(false)
    }
  }

  function openRegister() {
    setRegisterDomain('')
    setNewSite(null)
    setNewKeyVisible(false)
    setRegisterOpen(true)
  }

  function closeRegister() {
    setRegisterOpen(false)
    setNewSite(null)
    setRegisterDomain('')
  }

  // ── Edit domain ──────────────────────────────────────────────────────────────

  function openEditDomain(site: Site) {
    setEditSite(site)
    setEditDomain(site.domain)
  }

  async function handleSaveDomain() {
    if (!editSite) return
    const domain = editDomain.trim()
    if (!domain || domain === editSite.domain) { setEditSite(null); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/sites/${editSite.site_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setSites(prev => prev.map(s =>
          s.site_id === editSite.site_id ? { ...s, domain } : s
        ))
        setEditSite(null)
        toast.success('Domain updated')
      } else {
        toast.error(data.error ?? 'Failed to update domain')
      }
    } finally {
      setSaving(false)
    }
  }

  // ── Generate project key ─────────────────────────────────────────────────────

  async function handleGenerateKey(site: Site) {
    setGeneratingKeyId(site.site_id)
    try {
      const res = await fetch(`/api/admin/sites/${site.site_id}/generate-key`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        const updated: Site = data.site
        setSites(prev => prev.map(s => s.site_id === site.site_id ? updated : s))
        setViewKeySite(updated)
        setKeyVisible(true)
        toast.success('Project key generated')
      } else {
        toast.error(data.error ?? 'Failed to generate key')
      }
    } finally {
      setGeneratingKeyId(null)
    }
  }

  // ── Block/Unblock ────────────────────────────────────────────────────────────

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

  // ── Push Login ───────────────────────────────────────────────────────────────

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

  // ── Reset Trust ──────────────────────────────────────────────────────────────

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

  // ── Sessions ─────────────────────────────────────────────────────────────────

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

  // ── Per-site access (emails) ─────────────────────────────────────────────────

  async function openAccess(site: Site) {
    setAccessSite(site)
    setAccessEmails([])
    setNewAccessEmail('')
    setShowSuggestions(false)
    setAccessLoading(true)
    try {
      const [siteRes, globalRes] = await Promise.all([
        fetch(`/api/admin/sites/${site.site_id}/emails`),
        fetch('/api/admin/emails'),
      ])
      if (siteRes.ok) {
        const { emails } = await siteRes.json()
        setAccessEmails(emails)
      }
      if (globalRes.ok) {
        const { emails } = await globalRes.json()
        setGlobalEmails(emails)
      }
    } finally {
      setAccessLoading(false)
    }
  }

  async function handleAddAccessEmail() {
    if (!accessSite || !newAccessEmail.trim()) return
    setAddingEmail(true)
    try {
      const res = await fetch(`/api/admin/sites/${accessSite.site_id}/emails`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newAccessEmail.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setAccessEmails(data.emails)
        setNewAccessEmail('')
        toast.success('Email added')
      } else {
        toast.error(data.error ?? 'Failed to add email')
      }
    } finally {
      setAddingEmail(false)
    }
  }

  async function handleRemoveAccessEmail(email: string) {
    if (!accessSite) return
    setRemovingEmail(email)
    try {
      const res = await fetch(
        `/api/admin/sites/${accessSite.site_id}/emails/${encodeURIComponent(email)}`,
        { method: 'DELETE' }
      )
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setAccessEmails(data.emails)
        toast.success('Email removed')
      } else {
        toast.error(data.error ?? 'Failed to remove email')
      }
    } finally {
      setRemovingEmail(null)
    }
  }

  // ── Project Key badge/button (inline) ────────────────────────────────────────

  function ProjectKeyCell({ site }: { site: Site }) {
    if (site.project_key) {
      return (
        <button
          onClick={() => { setViewKeySite(site); setKeyVisible(false) }}
          className="inline-flex items-center gap-1 rounded px-2 py-0.5 font-mono text-[10px] bg-zinc-800 border border-zinc-700 text-zinc-300 hover:border-zinc-500 transition-colors"
          title="View project key"
        >
          <KeyRound className="h-2.5 w-2.5 text-zinc-500" />
          {truncateKey(site.project_key)}
        </button>
      )
    }
    return (
      <button
        disabled={generatingKeyId === site.site_id}
        onClick={() => handleGenerateKey(site)}
        className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium bg-amber-400/10 border border-amber-400/30 text-amber-400 hover:bg-amber-400/20 disabled:opacity-50 transition-colors"
        title="Generate a project key for this site"
      >
        {generatingKeyId === site.site_id ? (
          <Loader2 className="h-2.5 w-2.5 animate-spin" />
        ) : (
          <Key className="h-2.5 w-2.5" />
        )}
        Generate Key
      </button>
    )
  }

  // ── Action buttons (shared between table and grid) ───────────────────────────

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
          onClick={() => openAccess(site)}
          className="h-7 gap-1 text-xs border-zinc-700 text-violet-400"
        >
          <UserCheck className="h-3 w-3" />
          Access
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

  // ── View toggle ──────────────────────────────────────────────────────────────

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
      {/* Top bar: Register button + view toggle */}
      <div className="flex items-center justify-between px-6 pt-4 pb-2">
        <Button
          size="sm"
          onClick={openRegister}
          className="h-8 gap-1.5 text-xs"
        >
          <Plus className="h-3.5 w-3.5" />
          Register New Site
        </Button>
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
              <TableHead>Project Key</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sites.map(site => (
              <TableRow key={site.site_id}>
                <TableCell className="font-mono text-xs">
                  <div className="flex items-center gap-1.5">
                    {site.domain}
                    <button
                      onClick={() => openEditDomain(site)}
                      className="text-zinc-600 hover:text-zinc-300 transition-colors"
                      title="Edit domain"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  </div>
                </TableCell>
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
                  <ProjectKeyCell site={site} />
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
                  <div className="flex items-center gap-1.5">
                    <a
                      href={site.domain}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 font-mono text-xs text-white hover:underline truncate"
                    >
                      {site.domain}
                      <ExternalLink className="h-3 w-3 shrink-0 text-zinc-500" />
                    </a>
                    <button
                      onClick={() => openEditDomain(site)}
                      className="text-zinc-600 hover:text-zinc-300 transition-colors shrink-0"
                      title="Edit domain"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  </div>
                  <p className="mt-0.5 text-xs text-zinc-500">{site.owner_email ?? 'No owner'}</p>
                </div>
                <StatusBadge site={site} />
              </div>

              {/* Meta */}
              <div className="flex flex-wrap gap-3 text-[11px] text-zinc-500">
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

              {/* Project key */}
              <div>
                <ProjectKeyCell site={site} />
              </div>

              {/* Actions */}
              <ActionButtons site={site} />
            </div>
          ))}
        </div>
      )}

      {/* ── REGISTER NEW SITE DIALOG ───────────────────────────────────────── */}
      <Dialog open={registerOpen} onOpenChange={open => { if (!open) closeRegister() }}>
        <DialogContent className="bg-zinc-900 border-zinc-800 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Register New Site
            </DialogTitle>
            <DialogDescription>
              Enter the WordPress site domain. A unique project key will be generated.
            </DialogDescription>
          </DialogHeader>

          {!newSite ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs text-zinc-400">Domain</label>
                <Input
                  placeholder="https://example.com"
                  value={registerDomain}
                  onChange={e => setRegisterDomain(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !registering && handleRegister()}
                  className="bg-zinc-800 border-zinc-700 text-sm"
                  autoFocus
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" className="border-zinc-700" onClick={closeRegister}>
                  Cancel
                </Button>
                <Button onClick={handleRegister} disabled={registering || !registerDomain.trim()}>
                  {registering ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  Register Site
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs text-emerald-400">
                Site registered successfully. Copy the project key below and paste it into the plugin settings.
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-zinc-400">Project Key</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 font-mono text-xs text-zinc-200 overflow-hidden">
                    {newKeyVisible ? newSite.project_key : '••••••••••••••••••••••••••••'}
                  </div>
                  <button
                    onClick={() => setNewKeyVisible(v => !v)}
                    className="text-zinc-500 hover:text-zinc-300 transition-colors"
                    title={newKeyVisible ? 'Hide key' : 'Show key'}
                  >
                    {newKeyVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={() => {
                    navigator.clipboard.writeText(newSite.project_key ?? '')
                    toast.success('Project key copied')
                  }}
                >
                  <Copy className="h-4 w-4 mr-1" />
                  Copy Key
                </Button>
                <Button variant="outline" className="border-zinc-700" onClick={closeRegister}>
                  Done
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── EDIT DOMAIN DIALOG ────────────────────────────────────────────── */}
      <Dialog open={!!editSite} onOpenChange={open => { if (!open) setEditSite(null) }}>
        <DialogContent className="bg-zinc-900 border-zinc-800 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4" />
              Edit Domain
            </DialogTitle>
            <DialogDescription>
              Update the domain for this site. The plugin will use the new domain on the next ping.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400">Domain</label>
              <Input
                value={editDomain}
                onChange={e => setEditDomain(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !saving && handleSaveDomain()}
                className="bg-zinc-800 border-zinc-700 text-sm font-mono"
                autoFocus
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" className="border-zinc-700" onClick={() => setEditSite(null)}>
                Cancel
              </Button>
              <Button onClick={handleSaveDomain} disabled={saving || !editDomain.trim()}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Save Domain
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── VIEW PROJECT KEY DIALOG ───────────────────────────────────────── */}
      <Dialog open={!!viewKeySite} onOpenChange={open => { if (!open) { setViewKeySite(null); setKeyVisible(false) } }}>
        <DialogContent className="bg-zinc-900 border-zinc-800 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-zinc-400" />
              Project Key
            </DialogTitle>
            <DialogDescription className="font-mono text-xs">
              {viewKeySite?.domain}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-xs text-zinc-400">
              Paste this key into the plugin settings under <span className="font-mono text-zinc-300">Project Key</span>. Keep it secret — it authenticates all API calls from this site.
            </p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="flex-1 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 font-mono text-xs text-zinc-200 break-all">
                  {keyVisible ? viewKeySite?.project_key : '••••••••••••••••••••••••••••••••••••••••••••••••'}
                </div>
                <button
                  onClick={() => setKeyVisible(v => !v)}
                  className="text-zinc-500 hover:text-zinc-300 transition-colors shrink-0"
                  title={keyVisible ? 'Hide key' : 'Reveal key'}
                >
                  {keyVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={() => {
                  navigator.clipboard.writeText(viewKeySite?.project_key ?? '')
                  toast.success('Project key copied')
                }}
              >
                <Copy className="h-4 w-4 mr-1" />
                Copy Key
              </Button>
              <Button
                variant="outline"
                className="border-amber-400/30 text-amber-400 hover:bg-amber-400/10"
                disabled={generatingKeyId === viewKeySite?.site_id}
                onClick={() => viewKeySite && handleGenerateKey(viewKeySite)}
                title="Rotate — generates a new key (old key stops working immediately)"
              >
                {generatingKeyId === viewKeySite?.site_id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Rotate
              </Button>
            </div>
            <p className="text-[10px] text-zinc-600">Rotate only if the key is compromised. The old key stops working immediately.</p>
          </div>
        </DialogContent>
      </Dialog>

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

      {/* ── PER-SITE ACCESS DIALOG ───────────────────────────────────────── */}
      <Dialog open={!!accessSite} onOpenChange={open => { if (!open) setAccessSite(null) }}>
        <DialogContent className="bg-zinc-900 border-zinc-800 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-violet-400" />
              Site Access
            </DialogTitle>
            <DialogDescription className="font-mono text-xs">
              {accessSite?.domain}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Info */}
            <p className="text-xs text-zinc-400 leading-relaxed">
              Emails on the <span className="text-zinc-200">global list</span> always have access to every site.
              Add emails here to grant access to <span className="text-zinc-200">this site only</span>.
            </p>

            {/* Add email with autocomplete */}
            <div className="relative flex gap-2">
              <div className="relative flex-1">
                <Input
                  placeholder="Search or type an email…"
                  value={newAccessEmail}
                  onChange={e => { setNewAccessEmail(e.target.value); setShowSuggestions(true) }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); handleAddAccessEmail() }
                    if (e.key === 'Escape') setShowSuggestions(false)
                  }}
                  className="bg-zinc-800 border-zinc-700 text-sm w-full"
                  autoComplete="off"
                />
                {/* Dropdown suggestions */}
                {showSuggestions && (() => {
                  const q = newAccessEmail.toLowerCase()
                  const suggestions = globalEmails.filter(e =>
                    e.includes(q) && !accessEmails.includes(e)
                  )
                  if (suggestions.length === 0) return null
                  return (
                    <ul className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-md border border-zinc-700 bg-zinc-900 shadow-lg">
                      {suggestions.map(email => (
                        <li
                          key={email}
                          onMouseDown={() => {
                            setNewAccessEmail(email)
                            setShowSuggestions(false)
                          }}
                          className="cursor-pointer px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800 font-mono"
                        >
                          {email}
                        </li>
                      ))}
                    </ul>
                  )
                })()}
              </div>
              <Button
                size="sm"
                onClick={handleAddAccessEmail}
                disabled={addingEmail || !newAccessEmail.trim()}
                className="shrink-0"
              >
                {addingEmail ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              </Button>
            </div>

            {/* Email list */}
            <div className="rounded-md border border-zinc-800 overflow-hidden">
              {accessLoading ? (
                <div className="flex items-center justify-center py-8 text-zinc-500 text-sm gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                </div>
              ) : accessEmails.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-zinc-500 text-xs gap-1">
                  <UserCheck className="h-5 w-5 text-zinc-700" />
                  <span>No site-specific emails yet.</span>
                  <span className="text-zinc-600">Global list members still have access.</span>
                </div>
              ) : (
                <ul className="divide-y divide-zinc-800">
                  {accessEmails.map(email => (
                    <li key={email} className="flex items-center justify-between px-3 py-2.5">
                      <span className="text-xs text-zinc-300 font-mono">{email}</span>
                      <button
                        disabled={removingEmail === email}
                        onClick={() => handleRemoveAccessEmail(email)}
                        className="text-zinc-600 hover:text-red-400 transition-colors disabled:opacity-40"
                        title="Remove access"
                      >
                        {removingEmail === email
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Trash2 className="h-3.5 w-3.5" />}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex justify-end">
              <Button variant="outline" className="border-zinc-700" onClick={() => setAccessSite(null)}>
                Close
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
