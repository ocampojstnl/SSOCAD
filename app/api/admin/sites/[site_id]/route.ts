import { type NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import type { SessionData } from '@/lib/session'
import { sessionOptions } from '@/lib/session'
import { setSiteBlocked, updateSiteDomain } from '@/lib/storage'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ site_id: string }> }
) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
  if (!session.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const { site_id } = await params
  let body: { blocked?: boolean; domain?: string }
  try { body = await request.json() } catch { body = {} }

  if (typeof body.domain === 'string') {
    const domain = body.domain.trim()
    if (!domain) return NextResponse.json({ error: 'domain cannot be empty.' }, { status: 400 })
    const site = await updateSiteDomain(site_id, domain)
    if (!site) return NextResponse.json({ error: 'Site not found.' }, { status: 404 })
    return NextResponse.json({ ok: true, site })
  }

  if (typeof body.blocked === 'boolean') {
    const site = await setSiteBlocked(site_id, body.blocked)
    if (!site) return NextResponse.json({ error: 'Site not found.' }, { status: 404 })
    return NextResponse.json({ ok: true, site })
  }

  return NextResponse.json({ error: 'blocked (boolean) or domain (string) required.' }, { status: 400 })
}
