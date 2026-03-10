'use client'
import { useState } from 'react'
import {
  Plus, Bug, Sparkles, ChevronLeft, ChevronRight, Trash2, Loader2,
  AlertCircle, ArrowUp, Minus, ArrowDown, StickyNote,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import type { BugReport, BugStatus, BugType, BugPriority } from '@/lib/storage'

// ── Column definitions ────────────────────────────────────────────────────────

const COLUMNS: { id: BugStatus; label: string; color: string; dot: string }[] = [
  { id: 'backlog', label: 'Backlog',     color: 'border-zinc-700 bg-zinc-800/40', dot: 'bg-zinc-500' },
  { id: 'active',  label: 'In Progress', color: 'border-blue-500/30 bg-blue-500/5', dot: 'bg-blue-400' },
  { id: 'done',    label: 'Done',        color: 'border-emerald-500/30 bg-emerald-500/5', dot: 'bg-emerald-400' },
  { id: 'denied',  label: 'Denied',      color: 'border-red-500/30 bg-red-500/5', dot: 'bg-red-400' },
]

const STATUS_ORDER = COLUMNS.map(c => c.id)

function nextStatus(s: BugStatus): BugStatus | null {
  const i = STATUS_ORDER.indexOf(s)
  return i < STATUS_ORDER.length - 1 ? STATUS_ORDER[i + 1] : null
}
function prevStatus(s: BugStatus): BugStatus | null {
  const i = STATUS_ORDER.indexOf(s)
  return i > 0 ? STATUS_ORDER[i - 1] : null
}

// ── Priority helpers ──────────────────────────────────────────────────────────

const PRIORITY_CONFIG: Record<BugPriority, { label: string; icon: React.ElementType; color: string }> = {
  high:   { label: 'High',   icon: ArrowUp,   color: 'text-red-400' },
  medium: { label: 'Medium', icon: Minus,      color: 'text-amber-400' },
  low:    { label: 'Low',    icon: ArrowDown,  color: 'text-zinc-500' },
}

function PriorityIcon({ priority }: { priority: BugPriority }) {
  const { icon: Icon, color } = PRIORITY_CONFIG[priority]
  return <Icon className={`h-3 w-3 ${color}`} />
}

// ── Type badge ────────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: BugType }) {
  return type === 'bug' ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-400 border border-red-500/20">
      <Bug className="h-2.5 w-2.5" /> Bug
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 px-2 py-0.5 text-[10px] font-medium text-purple-400 border border-purple-500/20">
      <Sparkles className="h-2.5 w-2.5" /> Feature
    </span>
  )
}

// ── Date helper ───────────────────────────────────────────────────────────────

function relDate(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// ── New report form state ─────────────────────────────────────────────────────

interface NewForm {
  type: BugType
  title: string
  description: string
  priority: BugPriority
}

const EMPTY_FORM: NewForm = { type: 'bug', title: '', description: '', priority: 'medium' }

// ── Main component ────────────────────────────────────────────────────────────

export function BugsBoard({ initialReports }: { initialReports: BugReport[] }) {
  const [reports, setReports] = useState(initialReports)
  const [newOpen, setNewOpen] = useState(false)
  const [form, setForm] = useState<NewForm>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [editReport, setEditReport] = useState<BugReport | null>(null)
  const [editForm, setEditForm] = useState<Partial<BugReport>>({})
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [movingId, setMovingId] = useState<string | null>(null)

  // ── Create ────────────────────────────────────────────────────────────────

  async function handleCreate() {
    if (!form.title.trim() || !form.description.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/bugs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setReports(prev => [data.report, ...prev])
        setForm(EMPTY_FORM)
        setNewOpen(false)
        toast.success('Report created')
      } else {
        toast.error(data.error ?? 'Failed to create report')
      }
    } finally {
      setSubmitting(false)
    }
  }

  // ── Move (inline column arrows) ───────────────────────────────────────────

  async function handleMove(report: BugReport, direction: 'prev' | 'next') {
    const newStatus = direction === 'next' ? nextStatus(report.status) : prevStatus(report.status)
    if (!newStatus) return
    setMovingId(report.id)
    try {
      const res = await fetch(`/api/admin/bugs/${report.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setReports(prev => prev.map(r => r.id === report.id ? data.report : r))
      } else {
        toast.error(data.error ?? 'Failed to move card')
      }
    } finally {
      setMovingId(null)
    }
  }

  // ── Save edit ─────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!editReport) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/bugs/${editReport.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setReports(prev => prev.map(r => r.id === editReport.id ? data.report : r))
        setEditReport(null)
        toast.success('Saved')
      } else {
        toast.error(data.error ?? 'Failed to save')
      }
    } finally {
      setSaving(false)
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async function handleDelete() {
    if (!editReport) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/bugs/${editReport.id}`, { method: 'DELETE' })
      if (res.ok) {
        setReports(prev => prev.filter(r => r.id !== editReport.id))
        setEditReport(null)
        toast.success('Deleted')
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error ?? 'Failed to delete')
      }
    } finally {
      setDeleting(false)
    }
  }

  // ── Open edit dialog ──────────────────────────────────────────────────────

  function openEdit(report: BugReport) {
    setEditReport(report)
    setEditForm({
      type: report.type,
      title: report.title,
      description: report.description,
      priority: report.priority,
      status: report.status,
      notes: report.notes ?? '',
    })
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const total = reports.length

  return (
    <>
      {/* Page header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Bug Reports & Feature Requests</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {total} {total === 1 ? 'item' : 'items'} total
          </p>
        </div>
        <Button onClick={() => { setForm(EMPTY_FORM); setNewOpen(true) }} className="gap-1.5">
          <Plus className="h-4 w-4" />
          New Report
        </Button>
      </div>

      {/* Kanban board */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map(col => {
          const cards = reports.filter(r => r.status === col.id)
          return (
            <div key={col.id} className={`flex flex-col gap-3 rounded-xl border p-4 ${col.color}`}>
              {/* Column header */}
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${col.dot}`} />
                <span className="text-sm font-medium text-foreground">{col.label}</span>
                <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-zinc-700 px-1.5 text-[10px] font-bold text-zinc-300">
                  {cards.length}
                </span>
              </div>

              {/* Cards */}
              <div className="flex flex-col gap-2 min-h-[4rem]">
                {cards.length === 0 && (
                  <div className="flex items-center justify-center py-6 text-xs text-zinc-600 italic">
                    Empty
                  </div>
                )}
                {cards.map(report => (
                  <div
                    key={report.id}
                    className="group flex flex-col gap-2 rounded-lg border border-zinc-700 bg-zinc-900 p-3 cursor-pointer hover:border-zinc-500 transition-colors"
                    onClick={() => openEdit(report)}
                  >
                    {/* Type + priority row */}
                    <div className="flex items-center gap-1.5">
                      <TypeBadge type={report.type} />
                      <span className="ml-auto">
                        <PriorityIcon priority={report.priority} />
                      </span>
                    </div>

                    {/* Title */}
                    <p className="text-xs font-medium text-zinc-200 leading-snug line-clamp-2">
                      {report.title}
                    </p>

                    {/* Description snippet */}
                    {report.description && (
                      <p className="text-[11px] text-zinc-500 leading-snug line-clamp-2">
                        {report.description}
                      </p>
                    )}

                    {/* Notes indicator */}
                    {report.notes && (
                      <div className="flex items-center gap-1 text-[10px] text-zinc-600">
                        <StickyNote className="h-2.5 w-2.5" />
                        Note added
                      </div>
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-[10px] text-zinc-600">{relDate(report.created_at)}</span>
                      {/* Move buttons */}
                      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {prevStatus(report.status) && (
                          <button
                            onClick={e => { e.stopPropagation(); handleMove(report, 'prev') }}
                            disabled={movingId === report.id}
                            className="rounded p-0.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700 transition-colors disabled:opacity-40"
                            title={`Move to ${prevStatus(report.status)}`}
                          >
                            {movingId === report.id
                              ? <Loader2 className="h-3 w-3 animate-spin" />
                              : <ChevronLeft className="h-3 w-3" />}
                          </button>
                        )}
                        {nextStatus(report.status) && (
                          <button
                            onClick={e => { e.stopPropagation(); handleMove(report, 'next') }}
                            disabled={movingId === report.id}
                            className="rounded p-0.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700 transition-colors disabled:opacity-40"
                            title={`Move to ${nextStatus(report.status)}`}
                          >
                            {movingId === report.id
                              ? <Loader2 className="h-3 w-3 animate-spin" />
                              : <ChevronRight className="h-3 w-3" />}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── New Report Dialog ─────────────────────────────────────────────── */}
      <Dialog open={newOpen} onOpenChange={open => { if (!open) setNewOpen(false) }}>
        <DialogContent className="bg-zinc-900 border-zinc-800 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              New Report
            </DialogTitle>
            <DialogDescription>
              Submit a bug report or feature request to track and manage.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Type toggle */}
            <div className="flex gap-2">
              {(['bug', 'feature'] as BugType[]).map(t => (
                <button
                  key={t}
                  onClick={() => setForm(f => ({ ...f, type: t }))}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-medium transition-colors ${
                    form.type === t
                      ? t === 'bug'
                        ? 'border-red-500/40 bg-red-500/10 text-red-400'
                        : 'border-purple-500/40 bg-purple-500/10 text-purple-400'
                      : 'border-zinc-700 text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {t === 'bug' ? <Bug className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {t === 'bug' ? 'Bug Report' : 'Feature Request'}
                </button>
              ))}
            </div>

            {/* Title */}
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400">Title</label>
              <Input
                placeholder="Short summary…"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="bg-zinc-800 border-zinc-700 text-sm"
                autoFocus
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400">Description</label>
              <textarea
                placeholder="Steps to reproduce / what you'd like to see…"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={4}
                className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>

            {/* Priority */}
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400">Priority</label>
              <div className="flex gap-2">
                {(['low', 'medium', 'high'] as BugPriority[]).map(p => {
                  const { label, icon: Icon, color } = PRIORITY_CONFIG[p]
                  return (
                    <button
                      key={p}
                      onClick={() => setForm(f => ({ ...f, priority: p }))}
                      className={`flex-1 flex items-center justify-center gap-1 rounded-lg border py-1.5 text-xs transition-colors ${
                        form.priority === p
                          ? `border-zinc-500 bg-zinc-700 ${color}`
                          : 'border-zinc-700 text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      <Icon className="h-3 w-3" /> {label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" className="border-zinc-700" onClick={() => setNewOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={submitting || !form.title.trim() || !form.description.trim()}
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Create
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Edit Report Dialog ────────────────────────────────────────────── */}
      <Dialog open={!!editReport} onOpenChange={open => { if (!open) setEditReport(null) }}>
        <DialogContent className="bg-zinc-900 border-zinc-800 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              {editReport && <TypeBadge type={editForm.type ?? editReport.type} />}
              Edit Report
            </DialogTitle>
            <DialogDescription className="text-[11px]">
              Created {editReport && relDate(editReport.created_at)} · Last updated {editReport && relDate(editReport.updated_at)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Type toggle */}
            <div className="flex gap-2">
              {(['bug', 'feature'] as BugType[]).map(t => (
                <button
                  key={t}
                  onClick={() => setEditForm(f => ({ ...f, type: t }))}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg border py-1.5 text-xs font-medium transition-colors ${
                    (editForm.type ?? editReport?.type) === t
                      ? t === 'bug'
                        ? 'border-red-500/40 bg-red-500/10 text-red-400'
                        : 'border-purple-500/40 bg-purple-500/10 text-purple-400'
                      : 'border-zinc-700 text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {t === 'bug' ? <Bug className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {t === 'bug' ? 'Bug' : 'Feature'}
                </button>
              ))}
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400">Status</label>
              <div className="flex gap-1.5 flex-wrap">
                {COLUMNS.map(col => (
                  <button
                    key={col.id}
                    onClick={() => setEditForm(f => ({ ...f, status: col.id }))}
                    className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition-colors ${
                      (editForm.status ?? editReport?.status) === col.id
                        ? 'border-zinc-500 bg-zinc-700 text-white'
                        : 'border-zinc-700 text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${col.dot}`} />
                    {col.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400">Title</label>
              <Input
                value={editForm.title ?? ''}
                onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                className="bg-zinc-800 border-zinc-700 text-sm"
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400">Description</label>
              <textarea
                value={editForm.description ?? ''}
                onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                rows={3}
                className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>

            {/* Priority */}
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400">Priority</label>
              <div className="flex gap-2">
                {(['low', 'medium', 'high'] as BugPriority[]).map(p => {
                  const { label, icon: Icon, color } = PRIORITY_CONFIG[p]
                  return (
                    <button
                      key={p}
                      onClick={() => setEditForm(f => ({ ...f, priority: p }))}
                      className={`flex-1 flex items-center justify-center gap-1 rounded-lg border py-1.5 text-xs transition-colors ${
                        (editForm.priority ?? editReport?.priority) === p
                          ? `border-zinc-500 bg-zinc-700 ${color}`
                          : 'border-zinc-700 text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      <Icon className="h-3 w-3" /> {label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Admin notes */}
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400">Admin Notes <span className="text-zinc-600">(optional)</span></label>
              <textarea
                placeholder="Internal notes, decisions, links…"
                value={editForm.notes ?? ''}
                onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                rows={2}
                className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-1">
              <Button
                variant="ghost"
                size="sm"
                disabled={deleting}
                onClick={handleDelete}
                className="text-red-400 hover:text-red-300 hover:bg-red-400/10 mr-auto"
              >
                {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Trash2 className="h-3.5 w-3.5 mr-1" />}
                Delete
              </Button>
              <Button variant="outline" className="border-zinc-700" onClick={() => setEditReport(null)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
