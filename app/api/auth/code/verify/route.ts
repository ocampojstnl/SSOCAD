import { type NextRequest, NextResponse } from 'next/server'
import { authenticatePlugin } from '@/lib/guards'
import { markAuthCodeUsed, getNotificationEmail, isEmailAllowedForSite } from '@/lib/storage'
import { loadPrivateKey } from '@/lib/keys'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'

export async function POST(request: NextRequest) {
  const auth = await authenticatePlugin(request)
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }
  const site_id = 'site' in auth ? auth.site.site_id : null

  let body: { otp_token?: string; code?: string }
  try { body = await request.json() } catch { body = {} }

  const { otp_token, code } = body

  if (!otp_token || !code) {
    return NextResponse.json({ error: 'otp_token and code are required.' }, { status: 400 })
  }

  if (!/^\d{6}$/.test(String(code).trim())) {
    return NextResponse.json({ error: 'Code must be exactly 6 digits.' }, { status: 400 })
  }

  const otpSecret = process.env.OTP_SECRET
  const appUrl    = process.env.APP_URL

  // Verify the OTP session token
  let otpPayload: jwt.JwtPayload
  try {
    otpPayload = jwt.verify(otp_token, otpSecret!, {
      algorithms: ['HS256'],
      audience:   'otp-session',
      issuer:     appUrl,
    }) as jwt.JwtPayload
  } catch {
    return NextResponse.json(
      { error: 'Invalid or expired session. Please request a new code.' },
      { status: 403 },
    )
  }

  // Timing-safe code comparison
  const providedHash = crypto
    .createHmac('sha256', otpPayload.salt as string)
    .update(String(code).trim())
    .digest('hex')

  let codeMatches = false
  try {
    codeMatches = crypto.timingSafeEqual(
      Buffer.from(providedHash),
      Buffer.from(otpPayload.codeHash as string),
    )
  } catch { codeMatches = false }

  if (!codeMatches) {
    return NextResponse.json({ error: 'Incorrect code.' }, { status: 403 })
  }

  // Mark the request as used
  await markAuthCodeUsed(otp_token)

  // Use the notification email as the authenticated identity
  const notificationEmail = await getNotificationEmail()

  // Enforce per-site email access control
  if (site_id) {
    const allowed = await isEmailAllowedForSite(notificationEmail, site_id)
    if (!allowed) {
      return NextResponse.json({ error: 'Email not authorised for this site.' }, { status: 403 })
    }
  }

  // Issue RS256 login JWT for WordPress
  try {
    const privateKey = loadPrivateKey()
    const loginToken = jwt.sign(
      { email: notificationEmail, name: 'Admin', iss: appUrl, aud: 'wordpress-sso' },
      privateKey,
      { algorithm: 'RS256', expiresIn: '5m', jwtid: crypto.randomBytes(16).toString('hex') },
    )
    return NextResponse.json({ login_token: loginToken })
  } catch (err) {
    console.error('JWT signing error:', (err as Error).message)
    return NextResponse.json({ error: 'Failed to issue login token.' }, { status: 500 })
  }
}
