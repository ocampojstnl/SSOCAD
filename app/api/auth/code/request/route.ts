import { type NextRequest, NextResponse } from 'next/server'
import { verifyPluginSecret } from '@/lib/guards'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { loadNotificationEmail } = require('../../../../../config/notificationEmail')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { sendOtpEmail } = require('../../../../../config/mailer')

export async function POST(request: NextRequest) {
  if (!verifyPluginSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const notificationEmail = loadNotificationEmail()
  if (!notificationEmail) {
    return NextResponse.json(
      { error: 'Notification email is not configured. Set it via /admin/notification-email.' },
      { status: 500 },
    )
  }

  const appUrl   = process.env.APP_URL
  const otpSecret = process.env.OTP_SECRET
  if (!appUrl || !otpSecret) {
    return NextResponse.json({ error: 'APP_URL or OTP_SECRET not configured.' }, { status: 500 })
  }

  const code     = String(crypto.randomInt(100000, 999999))
  const salt     = crypto.randomBytes(16).toString('hex')
  const codeHash = crypto.createHmac('sha256', salt).update(code).digest('hex')

  const otpToken = jwt.sign(
    { codeHash, salt, email: notificationEmail, iss: appUrl, aud: 'otp-session' },
    otpSecret,
    { algorithm: 'HS256', expiresIn: '10m' },
  )

  try {
    await sendOtpEmail(notificationEmail, code)
  } catch (err) {
    console.error('Failed to send OTP email:', (err as Error).message)
    return NextResponse.json(
      { error: 'Failed to send authentication code. Check SMTP settings.' },
      { status: 500 },
    )
  }

  return NextResponse.json({ otp_token: otpToken, expires_in: 600 })
}
