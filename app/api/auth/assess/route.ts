import { type NextRequest, NextResponse } from 'next/server'
import { authenticatePlugin } from '@/lib/guards'
import {
  isBlacklisted,
  isEmailAllowedForSite,
  getTrustedSignal,
  getDevProfile,
  getSites,
} from '@/lib/storage'
import { computeTrustScore } from '@/lib/scoring'
import { loadPrivateKey } from '@/lib/keys'

const TRUST_THRESHOLD = 70

export async function POST(request: NextRequest) {
  const auth = await authenticatePlugin(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  let site_id = 'site' in auth ? auth.site.site_id : null

  let body: {
    ip?: string
    fingerprint_hash?: string
    cookie_user_email?: string | null
    site_domain?: string
    referrer?: string
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

  const { ip, fingerprint_hash, cookie_user_email, referrer } = body

  if (!ip || !fingerprint_hash) {
    return NextResponse.json({ error: 'ip and fingerprint_hash are required.' }, { status: 400 })
  }

  // ── Step 1: Hard block ────────────────────────────────────────────────────
  if (await isBlacklisted(ip)) {
    return NextResponse.json({ decision: 'BLOCKED' })
  }

  // ── Step 2: Site must be identifiable for per-site access control ─────────
  if (!site_id) {
    return NextResponse.json({ decision: 'UNCERTAIN' })
  }

  // ── Step 3: Conflict detection — same device, different users ────────────
  const signal = await getTrustedSignal(ip, fingerprint_hash)
  const db_user_email = signal?.email ?? null

  if (
    db_user_email && cookie_user_email &&
    db_user_email.toLowerCase() !== cookie_user_email.toLowerCase()
  ) {
    return NextResponse.json({ decision: 'UNCERTAIN' })
  }

  const user_email = db_user_email || cookie_user_email || null

  // ── Step 4: No known user → uncertain (no email to verify) ───────────────
  if (!user_email) {
    return NextResponse.json({ decision: 'UNCERTAIN' })
  }

  // ── Step 5: Per-site email access check ──────────────────────────────────
  const emailOk = await isEmailAllowedForSite(user_email, site_id)
  if (!emailOk) {
    return NextResponse.json({ decision: 'UNCERTAIN' })
  }

  // ── Step 6: Compute trust score ───────────────────────────────────────────
  const profile = await getDevProfile()
  const { score, reasons } = computeTrustScore({
    ip,
    fingerprint_hash,
    cookie_user_email: cookie_user_email ?? null,
    referrer,
    signal,
    profile,
  })

  console.log(`[assess] score=${score} reasons=${reasons.join(',')} ip=${ip}`)

  if (score < TRUST_THRESHOLD) {
    return NextResponse.json({ decision: 'UNCERTAIN' })
  }

  // ── Step 7: Issue RS256 login JWT ─────────────────────────────────────────
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
    return NextResponse.json({ decision: 'UNCERTAIN' })
  }
}
