import { type NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import type { SessionData } from '@/lib/session'
import { sessionOptions } from '@/lib/session'
import { getSite, addSiteEmail } from '@/lib/storage'

async function isAdmin() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
  return session.isAdmin === true
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ site_id: string }> }
) {
  if (!await isAdmin()) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  const { site_id } = await params
  const site = await getSite(site_id)
  if (!site) return NextResponse.json({ error: 'Site not found.' }, { status: 404 })
  return NextResponse.json({ emails: site.allowed_emails ?? [] })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ site_id: string }> }
) {
  if (!await isAdmin()) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  const { site_id } = await params

  let body: { email?: string } = {}
  try { body = await request.json() } catch { body = {} }

  const email = body.email?.toLowerCase().trim()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return NextResponse.json({ error: 'Valid email required.' }, { status: 400 })

  const site = await addSiteEmail(site_id, email)
  if (!site) return NextResponse.json({ error: 'Site not found.' }, { status: 404 })

  return NextResponse.json({ ok: true, emails: site.allowed_emails ?? [] })
}
