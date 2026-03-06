import { type NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import type { SessionData } from '@/lib/session'
import { sessionOptions } from '@/lib/session'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getSite } = require('../../../../../../config/sites')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { loadPrivateKey } = require('../../../../../../config/keys')

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ site_id: string }> },
) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
  if (!session.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const { site_id } = await params
  const site = getSite(site_id)

  if (!site) {
    return NextResponse.json({ error: 'Site not found.' }, { status: 404 })
  }
  if (!site.owner_email) {
    return NextResponse.json(
      { error: 'Site has no owner email on record. The owner must log in via SSO at least once.' },
      { status: 409 },
    )
  }
  if (!site.domain) {
    return NextResponse.json({ error: 'Site has no domain on record.' }, { status: 409 })
  }

  try {
    const privateKey = loadPrivateKey()
    const appUrl     = process.env.APP_URL
    if (!appUrl) throw new Error('APP_URL is not set')

    const push_token = jwt.sign(
      { email: site.owner_email, iss: appUrl, aud: 'push-login' },
      privateKey,
      { algorithm: 'RS256', expiresIn: '2m', jwtid: crypto.randomBytes(16).toString('hex') },
    )

    const push_url = `${site.domain.replace(/\/$/, '')}/?cad_dev_push_login=${encodeURIComponent(push_token)}`

    return NextResponse.json({ push_url, expires_in: 120 })
  } catch (err) {
    console.error('Push-login JWT error:', (err as Error).message)
    return NextResponse.json({ error: 'Failed to generate push-login token.' }, { status: 500 })
  }
}
