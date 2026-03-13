import {
  Server, Puzzle, Key, Globe, UserCheck, ShieldCheck,
  Layers, CheckCircle2, AlertTriangle, ChevronRight
} from 'lucide-react'

const Step = ({
  n, title, children
}: { n: number; title: string; children: React.ReactNode }) => (
  <div className="flex gap-4">
    <div className="flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-full bg-sky-500/10 ring-1 ring-sky-500/30 text-sky-400 text-sm font-bold mt-0.5">
      {n}
    </div>
    <div>
      <p className="font-semibold text-foreground mb-1">{title}</p>
      <div className="text-sm text-muted-foreground space-y-1">{children}</div>
    </div>
  </div>
)

const Code = ({ children }: { children: React.ReactNode }) => (
  <code className="bg-zinc-800 text-sky-300 rounded px-1.5 py-0.5 text-xs font-mono">{children}</code>
)

const Section = ({
  icon: Icon, color, title, children
}: { icon: React.ElementType; color: string; title: string; children: React.ReactNode }) => (
  <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
    <div className={`flex items-center gap-3 px-6 py-4 border-b border-zinc-800 ${color}`}>
      <Icon className="h-5 w-5" />
      <h2 className="font-semibold text-base">{title}</h2>
    </div>
    <div className="px-6 py-5 space-y-4">{children}</div>
  </div>
)

const Badge = ({ label, color }: { label: string; color: string }) => (
  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${color}`}>
    {label}
  </span>
)

export default function GuidePage() {
  return (
    <div className="max-w-3xl space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Setup Guide</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          How the Cad Dev SSO system works and how to connect a WordPress site to it.
        </p>
      </div>

      {/* How it works — 3 layers */}
      <Section icon={Layers} color="text-sky-400" title="How the 3-Layer Security Works">
        <p className="text-sm text-muted-foreground">
          Every login attempt goes through up to three layers. Each layer only runs if the previous
          one did not produce a confident result.
        </p>
        <div className="space-y-3 mt-2">
          <div className="flex items-start gap-3 rounded-lg bg-zinc-800/50 p-4">
            <Badge label="Layer 1" color="bg-green-500/15 text-green-400" />
            <div className="text-sm">
              <p className="font-medium text-foreground">Risk Assessment (silent)</p>
              <p className="text-muted-foreground mt-0.5">
                The plugin sends browser signals (IP, fingerprint, referrer, timing) to the web app.
                A trust score is calculated. Score ≥ 70 → <strong className="text-green-400">TRUSTED</strong> (auto sign-in).
                Score below threshold → proceed to Layer 2.
              </p>
            </div>
          </div>
          <div className="flex items-center justify-center text-zinc-600">
            <ChevronRight className="h-4 w-4 rotate-90" />
          </div>
          <div className="flex items-start gap-3 rounded-lg bg-zinc-800/50 p-4">
            <Badge label="Layer 2" color="bg-amber-500/15 text-amber-400" />
            <div className="text-sm">
              <p className="font-medium text-foreground">Identity Verification</p>
              <p className="text-muted-foreground mt-0.5">
                Shown only when Layer 1 is uncertain. The user signs in with
                <strong className="text-foreground"> Google SSO</strong> or requests an
                <strong className="text-foreground"> Auth Code</strong> (6-digit OTP sent to the
                web app). Their email is checked against the site's access list.
              </p>
            </div>
          </div>
          <div className="flex items-center justify-center text-zinc-600">
            <ChevronRight className="h-4 w-4 rotate-90" />
          </div>
          <div className="flex items-start gap-3 rounded-lg bg-zinc-800/50 p-4">
            <Badge label="Layer 3" color="bg-sky-500/15 text-sky-400" />
            <div className="text-sm">
              <p className="font-medium text-foreground">Token Verification (local)</p>
              <p className="text-muted-foreground mt-0.5">
                The web app issues a short-lived RS256 JWT. The WordPress plugin verifies it
                locally using the RSA public key — no network call needed. The private key
                never leaves the web app.
              </p>
            </div>
          </div>
        </div>
      </Section>

      {/* Web app setup */}
      <Section icon={Server} color="text-violet-400" title="Step 1 — Web App Setup">
        <div className="space-y-5">
          <Step n={1} title="Deploy the web app">
            <p>Deploy the <Code>cad-dev-sso</Code> project to Vercel (or any Node.js host).</p>
          </Step>
          <Step n={2} title="Generate RSA keys">
            <p>Run <Code>npm run generate-keys</Code> in the project root. This creates:</p>
            <ul className="mt-1 space-y-0.5 list-disc list-inside">
              <li><Code>keys/private.pem</Code> — stays on the server, never shared</li>
              <li><Code>keys/public.pem</Code> — copied into the WordPress plugin settings</li>
            </ul>
          </Step>
          <Step n={3} title="Set environment variables">
            <p>In your Vercel project settings (or <Code>.env</Code> for local dev):</p>
            <div className="mt-2 rounded-lg bg-zinc-800 p-3 font-mono text-xs text-zinc-300 space-y-0.5">
              <p><span className="text-zinc-500"># Required</span></p>
              <p>ADMIN_SECRET=<span className="text-amber-300">a-strong-random-secret</span></p>
              <p>SESSION_SECRET=<span className="text-amber-300">32-char-random-string</span></p>
              <p>RSA_PRIVATE_KEY=<span className="text-amber-300">"-----BEGIN RSA PRIVATE KEY-----\n..."</span></p>
              <p className="pt-1"><span className="text-zinc-500"># Google OAuth (for Layer 2 Google SSO)</span></p>
              <p>GOOGLE_CLIENT_ID=<span className="text-amber-300">...</span></p>
              <p>GOOGLE_CLIENT_SECRET=<span className="text-amber-300">...</span></p>
              <p className="pt-1"><span className="text-zinc-500"># Storage — one of these</span></p>
              <p>KV_REST_API_URL=<span className="text-amber-300">...</span>  <span className="text-zinc-500">(Vercel KV)</span></p>
              <p>DATA_DIR=<span className="text-amber-300">./data</span>  <span className="text-zinc-500">(local file fallback)</span></p>
            </div>
          </Step>
          <Step n={4} title="Log in to this dashboard">
            <p>
              Navigate to <Code>/login</Code> on your deployed web app and sign in with
              your <Code>ADMIN_SECRET</Code>.
            </p>
          </Step>
        </div>
      </Section>

      {/* Register a site */}
      <Section icon={Globe} color="text-emerald-400" title="Step 2 — Register a WordPress Site">
        <div className="space-y-5">
          <Step n={1} title="Go to Sites in the sidebar">
            <p>Click <strong className="text-foreground">Register New Site</strong> and enter the full domain of your WordPress site (e.g. <Code>https://example.com</Code>).</p>
          </Step>
          <Step n={2} title="Generate a Project Key">
            <p>
              After the site is registered, click <strong className="text-foreground">Generate Key</strong> in
              the Project Key column. Copy the key — you will need it in the plugin settings.
            </p>
            <div className="flex items-start gap-2 mt-2 rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
              <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300">The key is shown once. If you lose it, rotate it from the same column and re-paste it into the plugin.</p>
            </div>
          </Step>
          <Step n={3} title="Add email access">
            <p>
              Click <strong className="text-foreground">Access</strong> next to the site.
              Add the email addresses that are allowed to sign in to this specific site.
              Only emails on this list can authenticate — adding emails creates an exclusive allowlist.
            </p>
          </Step>
        </div>
      </Section>

      {/* Plugin setup */}
      <Section icon={Puzzle} color="text-sky-400" title="Step 3 — Install & Configure the WordPress Plugin">
        <div className="space-y-5">
          <Step n={1} title="Download and install the plugin">
            <p>
              Go to <strong className="text-foreground">Plugin &amp; Keys</strong> in this dashboard and
              download <Code>cad-dev.zip</Code>. Install it via
              <strong className="text-foreground"> WordPress Admin → Plugins → Add New → Upload</strong>.
            </p>
          </Step>
          <Step n={2} title="Open the plugin settings">
            <p>
              On a fresh install the plugin is visible to any admin.
              Go to <strong className="text-foreground">Settings → Cad Dev SSO</strong>.
            </p>
          </Step>
          <Step n={3} title="Fill in the settings">
            <div className="rounded-lg bg-zinc-800 divide-y divide-zinc-700 text-xs mt-1 overflow-hidden">
              {[
                ['Cad Dev SSO URL', 'The base URL of your deployed web app, e.g. https://sso.example.com'],
                ['RSA Public Key', 'Contents of keys/public.pem from your web app'],
                ['Project Key', 'The per-site key generated in Step 2 above'],
              ].map(([field, desc]) => (
                <div key={field} className="flex gap-3 px-3 py-2">
                  <span className="text-foreground font-medium w-32 flex-shrink-0">{field}</span>
                  <span className="text-muted-foreground">{desc}</span>
                </div>
              ))}
            </div>
          </Step>
          <Step n={4} title="Save — the plugin verifies automatically">
            <p>
              Click <strong className="text-foreground">Save Changes</strong>. The plugin will
              ping the web app to confirm the keys are correct.
            </p>
            <div className="mt-2 space-y-2">
              <div className="flex items-center gap-2 text-xs">
                <CheckCircle2 className="h-4 w-4 text-green-400 flex-shrink-0" />
                <span className="text-green-400 font-medium">Verified</span>
                <span className="text-muted-foreground">— plugin hides itself from normal WP users automatically.</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0" />
                <span className="text-red-400 font-medium">Failed</span>
                <span className="text-muted-foreground">— plugin stays visible so you can correct the settings.</span>
              </div>
            </div>
          </Step>
        </div>
      </Section>

      {/* First login */}
      <Section icon={UserCheck} color="text-amber-400" title="Step 4 — First Developer Login">
        <div className="space-y-5">
          <Step n={1} title="Navigate to the Cad Dev login page">
            <p>Go to <Code>https://your-wp-site.com/?cad_dev_login=1</Code></p>
            <p className="mt-1 text-zinc-500">Bookmark this URL — it is not linked anywhere on the site by design.</p>
          </Step>
          <Step n={2} title="Layer 1 runs silently">
            <p>Browser signals are assessed. On the first visit from a new device, the score will be too low and Layer 2 will be shown.</p>
          </Step>
          <Step n={3} title="Sign in via Google SSO or Auth Code">
            <p><strong className="text-foreground">Google SSO</strong> — click Sign in with Google and complete OAuth with an email that is on the site's access list.</p>
            <p className="mt-1"><strong className="text-foreground">Auth Code</strong> — click Request Code. A 6-digit code appears in this dashboard under <strong className="text-foreground">Auth Codes</strong>. Paste it in the form. No email required — the code itself is the credential.</p>
          </Step>
          <Step n={4} title="You are signed in as admin">
            <p>
              WordPress creates your account automatically (or reuses an existing one by email).
              Your display name is set to <Code>Cad Dev</Code> and the admin dashboard gets
              the Cad Dev Developer Mode theme.
            </p>
          </Step>
        </div>
      </Section>

      {/* Security notes */}
      <Section icon={ShieldCheck} color="text-rose-400" title="Security Notes">
        <ul className="space-y-2 text-sm text-muted-foreground list-none">
          {[
            'The RSA private key never leaves the web app — the plugin only holds the public key.',
            'Auth codes are one-time-use and expire after 10 minutes. A wrong guess does not consume the code.',
            'After 5 failed login attempts from the same IP, that IP is banned for 12 hours. Admins can unban from IP Lists.',
            'The plugin is invisible on the WordPress plugins page to any user who did not sign in via SSO.',
            'Per-site email lists are exclusive — only listed emails can access that site.',
            'Layer 1 trust scores are built from collective developer behaviour (multi-site presence, working hours, known dev-tool referrers). Scores improve over time as more verified logins are recorded.',
          ].map((note) => (
            <li key={note} className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <span>{note}</span>
            </li>
          ))}
        </ul>
      </Section>

      {/* Quick reference */}
      <Section icon={Key} color="text-zinc-400" title="Quick Reference">
        <div className="rounded-lg bg-zinc-800 divide-y divide-zinc-700 text-xs overflow-hidden">
          {[
            ['Developer login page',  'https://your-wp-site.com/?cad_dev_login=1'],
            ['Web app dashboard',     'https://your-sso-app.com/dashboard'],
            ['Auth codes',            'Dashboard → Auth Codes (approve pending requests here)'],
            ['Add emails to a site',  'Dashboard → Sites → Access button'],
            ['Rotate a project key',  'Dashboard → Sites → Project Key column → Rotate'],
            ['Download plugin zip',   'Dashboard → Plugin & Keys'],
            ['Unban an IP',           'Dashboard → IP Lists → Temporary Bans'],
          ].map(([label, value]) => (
            <div key={label} className="flex gap-3 px-3 py-2.5">
              <span className="text-foreground font-medium w-44 flex-shrink-0">{label}</span>
              <span className="text-muted-foreground font-mono">{value}</span>
            </div>
          ))}
        </div>
      </Section>

    </div>
  )
}
