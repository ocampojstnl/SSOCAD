import { type NextRequest, NextResponse } from 'next/server'
import { authenticatePlugin } from '@/lib/guards'
import { isWhitelisted, isBlacklisted, isEmailAllowed, isEmailAllowedForSite, getTrustedSignal, getSites } from '@/lib/storage'
import { loadPrivateKey } from '@/lib/keys'

export async function POST(request: NextRequest) {
  const auth = await authenticatePlugin(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  // When a per-site project key is used we know which site is calling
  let site_id = 'site' in auth ? auth.site.site_id : null

  let body: {
    ip?: string
    fingerprint_hash?: string
    cookie_user_email?: string | null
    site_domain?: string
  }
  try { body = await request.json() } catch { body = {} }

  // In legacy mode (shared secret), resolve site_id from the reported domain
  if (!site_id && body.site_domain) {
    try {
      const origin = new URL(body.site_domain).origin
      const sites  = await getSites()
      const match  = sites.find(s => { try { return new URL(s.domain).origin === origin } catch { return false } })
      if (match) site_id = match.site_id
    } catch { /* ignore bad domain */ }
  }

  const { ip, fingerprint_hash, cookie_user_email } = body

  if (!ip || !fingerprint_hash) {
    return NextResponse.json({ error: 'ip and fingerprint_hash are required.' }, { status: 400 })
  }

  // Look up trusted signal from web app's own storage (single source of truth)
  const signal = await getTrustedSignal(ip, fingerprint_hash)
  const db_user_email = signal?.email ?? null

  // Step 1: Hard block — IP on blacklist
  if (await isBlacklisted(ip)) {
    return NextResponse.json({ decision: 'BLOCKED' })
  }

  // Step 2: Conflict detection — same machine, different users → uncertain
  if (
    db_user_email && cookie_user_email &&
    db_user_email.toLowerCase() !== cookie_user_email.toLowerCase()
  ) {
    return NextResponse.json({ decision: 'UNCERTAIN' })
  }

  // Step 3: No known user → uncertain
  const user_email = db_user_email || cookie_user_email
  if (!user_email) {
    return NextResponse.json({ decision: 'UNCERTAIN' })
  }

  // Step 4: Access check — email not allowed for this site → force re-authentication
  // Return UNCERTAIN (not BLOCKED) so the user can still attempt Layer 2.
  // The actual authorization check happens when the JWT is issued at Layer 2.
  const emailOk = site_id
    ? await isEmailAllowedForSite(user_email, site_id)
    : await isEmailAllowed(user_email)
  if (!emailOk) {
    return NextResponse.json({ decision: 'UNCERTAIN' })
  }

  // Step 5: TRUSTED only if:
  //   - IP is explicitly whitelisted, OR
  //   - DB record AND session cookie both present and agree (same person, same device).
  //   A DB-only match without the cookie is not enough — the fingerprint alone can't
  //   distinguish different users on the same physical machine (same UA/screen/TZ).
  const dbAndCookieAgree = !!db_user_email && !!cookie_user_email
  const trusted = (await isWhitelisted(ip)) || dbAndCookieAgree
  if (!trusted) {
    return NextResponse.json({ decision: 'UNCERTAIN' })
  }

  // Issue RS256 login JWT
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const jwt    = require('jsonwebtoken')
    const crypto = (await import('crypto')).default

    const privateKey = loadPrivateKey()
    const appUrl     = process.env.APP_URL
    if (!appUrl) throw new Error('APP_URL is not set')

    const login_token = jwt.sign(
      { email: user_email, name: '', iss: appUrl, aud: 'wordpress-sso' },
      privateKey,
      { algorithm: 'RS256', expiresIn: '5m', jwtid: crypto.randomBytes(16).toString('hex') },
    )

    return NextResponse.json({ decision: 'TRUSTED', login_token })
  } catch (err) {
    console.error('Assess JWT signing error:', (err as Error).message)
    // Fail open — show login form rather than blocking
    return NextResponse.json({ decision: 'UNCERTAIN' })
  }
}
