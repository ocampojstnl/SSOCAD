import { type NextRequest, NextResponse } from 'next/server'
import { verifyPluginSecret } from '@/lib/guards'
import { addAuthCodeRequest } from '@/lib/storage'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'

export async function POST(request: NextRequest) {
  if (!verifyPluginSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const appUrl    = process.env.APP_URL
  const otpSecret = process.env.OTP_SECRET
  if (!appUrl || !otpSecret) {
    return NextResponse.json({ error: 'APP_URL or OTP_SECRET not configured.' }, { status: 500 })
  }

  let body: { site_domain?: string } = {}
  try { body = await request.json() } catch { body = {} }
  const site_domain = body.site_domain ?? 'unknown'

  const code     = String(crypto.randomInt(100000, 999999))
  const salt     = crypto.randomBytes(16).toString('hex')
  const codeHash = crypto.createHmac('sha256', salt).update(code).digest('hex')
  const id       = crypto.randomBytes(16).toString('hex')

  const otp_token = jwt.sign(
    { id, codeHash, salt, iss: appUrl, aud: 'otp-session' },
    otpSecret,
    { algorithm: 'HS256', expiresIn: '10m' },
  )

  await addAuthCodeRequest({
    id,
    site_domain,
    code,
    otp_token,
    requested_at: new Date().toISOString(),
    used: false,
  })

  return NextResponse.json({ otp_token, expires_in: 600 })
}
