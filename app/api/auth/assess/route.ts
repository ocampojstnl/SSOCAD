import { type NextRequest, NextResponse } from 'next/server'
import { verifyPluginSecret } from '@/lib/guards'
import { isWhitelisted, isBlacklisted, isEmailAllowed } from '@/lib/storage'
import { loadPrivateKey } from '@/lib/keys'

export async function POST(request: NextRequest) {
  if (!verifyPluginSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  let body: {
    ip?: string
    fingerprint_hash?: string
    db_user_email?: string | null
    cookie_user_email?: string | null
  }
  try { body = await request.json() } catch { body = {} }

  const { ip, fingerprint_hash, db_user_email, cookie_user_email } = body

  if (!ip || !fingerprint_hash) {
    return NextResponse.json({ error: 'ip and fingerprint_hash are required.' }, { status: 400 })
  }

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

  // Step 4: Revocation check
  if (!await isEmailAllowed(user_email)) {
    return NextResponse.json({ decision: 'BLOCKED' })
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
