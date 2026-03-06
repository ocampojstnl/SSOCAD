import { type NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import { OAuth2Client } from 'google-auth-library'
import crypto from 'crypto'
import type { SessionData } from '@/lib/session'
import { sessionOptions } from '@/lib/session'

const client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI,
)

export async function GET(request: NextRequest) {
  const nonce = crypto.randomBytes(16).toString('hex')

  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
  session.oauthNonce = nonce
  await session.save()

  const authUrl = client.generateAuthUrl({
    access_type: 'online',
    scope: ['email', 'profile'],
    state: nonce,
    prompt: 'select_account',
  })

  return NextResponse.redirect(authUrl)
}
