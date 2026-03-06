import { Globe } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SitesTable } from '@/components/dashboard/sites-table'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { loadSites } = require('../../../config/sites')

interface Site {
  site_id: string; domain: string; owner_email: string | null
  plugin_version: string; registered_at: string; last_seen: string
}

export default function SitesPage() {
  const sites: Site[] = loadSites()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Registered Sites</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          WordPress installs with the Cad Dev plugin active.
        </p>
      </div>

      <Card className="border-zinc-800 bg-zinc-900">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">All Sites</CardTitle>
          </div>
          <CardDescription>
            {sites.length} registered site{sites.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {sites.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">
              No sites registered yet. Sites appear here automatically when the plugin is activated.
            </p>
          ) : (
            <SitesTable sites={sites} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
