import { type NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import type { SessionData } from '@/lib/session'
import { sessionOptions } from '@/lib/session'
import { getSites } from '@/lib/storage'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ site_id: string }> },
) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
  if (!session.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const { site_id } = await params
  const sites = await getSites()
  const site = sites.find(s => s.site_id === site_id)

  if (!site) {
    return NextResponse.json({ error: 'Site not found.' }, { status: 404 })
  }
  if (!site.domain) {
    return NextResponse.json({ error: 'Site has no domain on record.' }, { status: 409 })
  }

  let body: { email?: string } = {}
  try { body = await request.json() } catch { /* no body = reset all */ }

  const pluginSecret = process.env.PLUGIN_SECRET
  if (!pluginSecret) {
    return NextResponse.json({ error: 'PLUGIN_SECRET is not configured.' }, { status: 500 })
  }

  const endpoint = `${site.domain.replace(/\/$/, '')}/?cad_dev_action=reset_trust`

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-plugin-secret': pluginSecret,
      },
      body: JSON.stringify(body.email ? { email: body.email } : {}),
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      return NextResponse.json(
        { error: data.error ?? 'WordPress site returned an error.' },
        { status: res.status },
      )
    }

    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json(
      { error: `Could not reach site: ${(err as Error).message}` },
      { status: 502 },
    )
  }
}
