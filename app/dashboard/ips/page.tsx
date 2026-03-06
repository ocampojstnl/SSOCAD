import { Shield } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { IpList } from '@/components/dashboard/ip-list'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { loadWhitelist, loadBlacklist } = require('../../../config/ipLists')

export default function IpsPage() {
  const whitelist: string[] = loadWhitelist()
  const blacklist: string[] = loadBlacklist()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">IP Lists</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Whitelisted IPs are always trusted. Blacklisted IPs are always blocked.
        </p>
      </div>

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
