import { type NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import type { SessionData } from '@/lib/session'
import { sessionOptions } from '@/lib/session'
import { getSite, deleteTrustedSignals } from '@/lib/storage'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ site_id: string }> },
) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
  if (!session.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const { site_id } = await params
  const site = await getSite(site_id)

  if (!site) {
    return NextResponse.json({ error: 'Site not found.' }, { status: 404 })
  }

  let body: { email?: string } = {}
  try { body = await request.json() } catch { /* no body = reset by owner email */ }

  // Use provided email, or fall back to the site's registered owner email
  const targetEmail = body.email?.trim() || site.owner_email || undefined
  const deleted = await deleteTrustedSignals(targetEmail)

  return NextResponse.json({ deleted })
}
