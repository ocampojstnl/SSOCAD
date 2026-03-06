import { Mail, Shield, Globe, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getEmails, getWhitelist, getBlacklist, getSites } from '@/lib/storage'

export const dynamic = 'force-dynamic'

interface Site {
  site_id: string; domain: string; owner_email: string | null
  plugin_version: string; registered_at: string; last_seen: string
}

function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
}

export default async function DashboardPage() {
  const [emails, whitelist, blacklist, sites] = await Promise.all([
    getEmails(), getWhitelist(), getBlacklist(), getSites(),
  ])

  const recentSites = [...sites]
    .sort((a, b) => new Date(b.last_seen).getTime() - new Date(a.last_seen).getTime())
    .slice(0, 8)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cad Dev SSO system status at a glance.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-zinc-800 bg-zinc-900">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Allowed Emails</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{emails.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">Authorized developers</p>
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-900">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Registered Sites</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{sites.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">WordPress installs</p>
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-900">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Whitelisted IPs</CardTitle>
            <Shield className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{whitelist.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">Always trusted</p>
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-900">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Blacklisted IPs</CardTitle>
            <Shield className="h-4 w-4 text-red-400" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{blacklist.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">Always blocked</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent sites */}
      <Card className="border-zinc-800 bg-zinc-900">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Recent Sites</CardTitle>
          </div>
          <CardDescription>WordPress installs sorted by last activity.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {recentSites.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">
              No sites registered yet. Sites appear here automatically when the plugin is activated.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Domain</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Last Seen</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentSites.map(site => {
                  const days = daysSince(site.last_seen)
                  const status = days <= 35 ? 'active' : days <= 90 ? 'idle' : 'stale'
                  return (
                    <TableRow key={site.site_id}>
                      <TableCell className="font-mono text-xs">{site.domain}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{site.owner_email ?? '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{site.plugin_version}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {days === 0 ? 'Today' : `${days}d ago`}
                      </TableCell>
                      <TableCell>
                        <Badge variant={status === 'active' ? 'success' : status === 'idle' ? 'warning' : 'destructive'}>
                          {status}
                        </Badge>
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
