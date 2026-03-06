import { Puzzle, Key, Link2, Download } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { CopyField } from '@/components/dashboard/copy-field'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { loadPublicKey } = require('../../../config/keys')

function safeLoadPublicKey(): string {
  try { return loadPublicKey() } catch { return '' }
}

export default function PluginPage() {
  const publicKey    = safeLoadPublicKey()
  const pluginSecret = process.env.PLUGIN_SECRET ?? ''
  const appUrl       = process.env.APP_URL ?? ''

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Plugin &amp; Keys</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Copy these values into the WordPress plugin settings to connect a site to this SSO.
        </p>
      </div>

      {/* Download */}
      <Card className="border-zinc-800 bg-zinc-900">
        <CardHeader className="flex flex-row items-center gap-3 pb-3">
          <Download className="h-4 w-4 text-muted-foreground" />
          <div>
            <CardTitle className="text-base">WordPress Plugin</CardTitle>
            <CardDescription>Install the cad-dev plugin on each WordPress site.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload via{' '}
              <span className="font-mono text-xs text-foreground">Plugins → Add New → Upload Plugin</span>,
              then activate it. The plugin settings page will appear under{' '}
              <span className="font-mono text-xs text-foreground">Settings → Cad Dev SSO</span>.
            </p>
            <a
              href="/downloadables/plugin/cad-dev.zip"
              download
              className="inline-flex items-center gap-2 rounded-md bg-zinc-800 px-4 py-2 text-sm font-medium text-foreground ring-1 ring-zinc-700 transition-colors hover:bg-zinc-700"
            >
              <Download className="h-4 w-4" />
              Download cad-dev.zip
            </a>
          </div>
        </CardContent>
      </Card>

      {/* SSO Endpoint */}
      <Card className="border-zinc-800 bg-zinc-900">
        <CardHeader className="flex flex-row items-center gap-3 pb-3">
          <Link2 className="h-4 w-4 text-muted-foreground" />
          <div>
            <CardTitle className="text-base">SSO Endpoint</CardTitle>
            <CardDescription>Paste this into the &ldquo;SSO URL&rdquo; field in the plugin settings.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {appUrl ? (
            <CopyField value={appUrl} />
          ) : (
            <p className="text-sm text-amber-400">
              APP_URL environment variable is not set. Add it in Vercel → Settings → Environment Variables.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Plugin Secret */}
      <Card className="border-zinc-800 bg-zinc-900">
        <CardHeader className="flex flex-row items-center gap-3 pb-3">
          <Key className="h-4 w-4 text-muted-foreground" />
          <div>
            <CardTitle className="text-base">Plugin Secret</CardTitle>
            <CardDescription>Paste this into the &ldquo;Plugin Secret&rdquo; field in the plugin settings.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {pluginSecret ? (
            <CopyField value={pluginSecret} />
          ) : (
            <p className="text-sm text-amber-400">
              PLUGIN_SECRET environment variable is not set. Add it in Vercel → Settings → Environment Variables.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Public Key */}
      <Card className="border-zinc-800 bg-zinc-900">
        <CardHeader className="flex flex-row items-center gap-3 pb-3">
          <Puzzle className="h-4 w-4 text-muted-foreground" />
          <div>
            <CardTitle className="text-base">RSA Public Key</CardTitle>
            <CardDescription>Paste this into the &ldquo;Public Key&rdquo; field in the plugin settings.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {publicKey ? (
            <CopyField value={publicKey} rows={10} />
          ) : (
            <p className="text-sm text-amber-400">
              No public key found. Generate keys by running{' '}
              <span className="font-mono text-xs text-foreground">npm run generate-keys</span>{' '}
              and ensure the keys/ directory is deployed.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
