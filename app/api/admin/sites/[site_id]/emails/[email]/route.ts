import { type NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import type { SessionData } from '@/lib/session'
import { sessionOptions } from '@/lib/session'
import { removeSiteEmail } from '@/lib/storage'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ site_id: string; email: string }> }
) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
  if (!session.isAdmin) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const { site_id, email } = await params
  const site = await removeSiteEmail(site_id, decodeURIComponent(email))
  if (!site) return NextResponse.json({ error: 'Site not found.' }, { status: 404 })

  return NextResponse.json({ ok: true, emails: site.allowed_emails ?? [] })
}
