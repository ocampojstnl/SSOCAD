'use client'
import { useEffect, useRef, useState } from 'react'
import { Bell, Clock, Globe, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'

interface AuthCodeRequest {
  id: string
  site_domain: string
  code: string
  otp_token: string
  requested_at: string
  used: boolean
}

const POLL_INTERVAL = 3000 // 3 seconds

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'Just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  return `${Math.floor(hr / 24)}d ago`
}

function isExpired(iso: string) {
  return Date.now() - new Date(iso).getTime() > 10 * 60 * 1000
}

function getStatus(r: AuthCodeRequest) {
  if (r.used) return 'used'
  if (isExpired(r.requested_at)) return 'expired'
  return 'pending'
}

export default function AuthCodesPage() {
  const [requests, setRequests] = useState<AuthCodeRequest[]>([])
  const [loading, setLoading] = useState(true)
  const knownIds = useRef<Set<string>>(new Set())
  const isFirstLoad = useRef(true)

  async function fetchRequests() {
    try {
      const res = await fetch('/api/admin/auth-codes')
      if (!res.ok) return
      const { requests: data } = await res.json()
      setRequests(data)

      // Detect new pending requests after first load
      const newPending = (data as AuthCodeRequest[]).filter(
        r => !r.used && !isExpired(r.requested_at) && !knownIds.current.has(r.id)
      )

      if (!isFirstLoad.current && newPending.length > 0) {
        newPending.forEach(r => {
          toast(`New auth code request from ${r.site_domain}`, {
            description: (
              <span>
                Code:{' '}
                <span className="font-mono font-bold tracking-widest text-sky-300">{r.code}</span>
              </span>
            ) as unknown as string,
            duration: 15000,
          })
        })
      }

      // Update known IDs
      ;(data as AuthCodeRequest[]).forEach(r => knownIds.current.add(r.id))
      isFirstLoad.current = false
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRequests()
    const interval = setInterval(fetchRequests, POLL_INTERVAL)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pending = requests.filter(r => !r.used && !isExpired(r.requested_at))

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-zinc-500 gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Loading auth codes…</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Auth Code Requests</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Login code requests from WordPress sites. Share the code with the developer.
          </p>
        </div>
        {/* Live indicator */}
        <div className="flex items-center gap-1.5 rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-400">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          Live
        </div>
      </div>

      {/* Pending banner */}
      {pending.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <Bell className="h-4 w-4 text-amber-400 flex-shrink-0" />
          <p className="text-sm text-amber-300">
            <span className="font-semibold">{pending.length} pending</span>{' '}
            {pending.length === 1 ? 'request' : 'requests'} waiting for a code to be shared.
          </p>
        </div>
      )}

      {/* Pending requests */}
      {pending.length > 0 && (
        <Card className="border-amber-500/30 bg-zinc-900">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-400" />
              <CardTitle className="text-base">Pending — Share These Codes</CardTitle>
            </div>
            <CardDescription>These codes expire 10 minutes after requested.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Site</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Requested</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="flex items-center gap-2 font-mono text-xs">
                      <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                      {r.site_domain}
                    </TableCell>
                    <TableCell>
                      <span className="rounded bg-zinc-800 px-3 py-1 font-mono text-lg font-bold tracking-widest text-sky-300">
                        {r.code}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {timeAgo(r.requested_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* All requests history */}
      <Card className="border-zinc-800 bg-zinc-900">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Request History</CardTitle>
          </div>
          <CardDescription>
            {requests.length} total request{requests.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {requests.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">
              No auth code requests yet. They appear here when a developer clicks &quot;Login with Auth Code&quot; on a WordPress site.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Site</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map(r => {
                  const status = getStatus(r)
                  return (
                    <TableRow key={r.id} className={status !== 'pending' ? 'opacity-50' : ''}>
                      <TableCell className="font-mono text-xs">{r.site_domain}</TableCell>
                      <TableCell>
                        <span
                          className={`font-mono text-sm tracking-widest ${status === 'used' ? 'line-through text-zinc-500' : ''}`}
                        >
                          {r.code}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(r.requested_at).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {status === 'used' && (
                          <Badge variant="success" className="gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Used
                          </Badge>
                        )}
                        {status === 'expired' && (
                          <Badge variant="destructive" className="gap-1">
                            <XCircle className="h-3 w-3" /> Expired
                          </Badge>
                        )}
                        {status === 'pending' && (
                          <Badge variant="warning" className="gap-1">
                            <Clock className="h-3 w-3" /> Pending
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
