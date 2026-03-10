import { type NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import type { SessionData } from '@/lib/session'
import { sessionOptions } from '@/lib/session'
import { getSites, createSiteByAdmin } from '@/lib/storage'

export async function GET() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
  if (!session.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  return NextResponse.json({ sites: await getSites() })
}

export async function POST(request: NextRequest) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
  if (!session.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  let body: { domain?: string } = {}
  try { body = await request.json() } catch { body = {} }

  const domain = (body.domain ?? '').trim()
  if (!domain) {
    return NextResponse.json({ error: 'domain is required.' }, { status: 400 })
  }

  const site = await createSiteByAdmin(domain)
  return NextResponse.json({ site }, { status: 201 })
}
