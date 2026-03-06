import { type NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import type { SessionData } from '@/lib/session'
import { sessionOptions } from '@/lib/session'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { setSiteBlocked } = require('../../../../../config/sites')

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ site_id: string }> }
) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
  if (!session.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const { site_id } = await params
  let body: { blocked?: boolean }
  try { body = await request.json() } catch { body = {} }

  if (typeof body.blocked !== 'boolean') {
    return NextResponse.json({ error: 'blocked (boolean) required.' }, { status: 400 })
  }

  const site = setSiteBlocked(site_id, body.blocked)
  if (!site) {
    return NextResponse.json({ error: 'Site not found.' }, { status: 404 })
  }

  return NextResponse.json({ ok: true, site })
}
