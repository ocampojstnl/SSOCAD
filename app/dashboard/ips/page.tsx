import { Shield } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { IpList } from '@/components/dashboard/ip-list'
import { TempBanList } from '@/components/dashboard/temp-ban-list'
import { getWhitelist, getBlacklist, getTempBans } from '@/lib/storage'

export const dynamic = 'force-dynamic'

export default async function IpsPage() {
  const [whitelist, blacklist, bans] = await Promise.all([getWhitelist(), getBlacklist(), getTempBans()])
  const activeBans = bans.filter(b => b.active && new Date(b.expires_at).getTime() > Date.now())

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">IP Lists</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Whitelisted IPs are always trusted. Blacklisted IPs are always blocked.
        </p>
      </div>

      {activeBans.length > 0 && (
        <Card className="border-red-800 bg-zinc-900">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-red-400" />
              <CardTitle className="text-base text-red-400">Temporary Bans</CardTitle>
            </div>
            <CardDescription>
              {activeBans.length} IP{activeBans.length !== 1 ? 's' : ''} temporarily banned — auto-expires after 12 hours
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TempBanList initialBans={activeBans} />
          </CardContent>
        </Card>
      )}

      <Card className="border-zinc-800 bg-zinc-900">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">IP Address Rules</CardTitle>
          </div>
          <CardDescription>
            {whitelist.length} whitelisted · {blacklist.length} blacklisted
          </CardDescription>
        </CardHeader>
        <CardContent>
          <IpList initialWhitelist={whitelist} initialBlacklist={blacklist} />
        </CardContent>
      </Card>
    </div>
  )
}
