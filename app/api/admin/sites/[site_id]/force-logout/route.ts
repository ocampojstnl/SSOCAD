import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import type { SessionData } from '@/lib/session'
import { sessionOptions } from '@/lib/session'
import { getSite, markSessionLoggedOut } from '@/lib/storage'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ site_id: string }> }
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

  const body = await request.json().catch(() => ({}))
  const { email } = body
  if (!email) {
    return NextResponse.json({ error: 'email is required' }, { status: 400 })
  }

  const pluginSecret = process.env.PLUGIN_SECRET
  if (!pluginSecret) {
    return NextResponse.json({ error: 'PLUGIN_SECRET not configured.' }, { status: 500 })
  }

  // Tell the WordPress plugin to destroy this user's session tokens
  let wpOk = false
  try {
    const res = await fetch(`${site.domain}/?cad_dev_action=force_logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-plugin-secret': pluginSecret },
      body: JSON.stringify({ email }),
      signal: AbortSignal.timeout(8000),
    })
    const data = await res.json().catch(() => ({}))
    wpOk = res.ok && data.ok === true
  } catch {
    // Plugin unreachable — still mark as signed_out in our storage
  }

  // Mark the session as signed_out in the web app's own storage
  await markSessionLoggedOut(site_id, email)

  return NextResponse.json({ ok: true, wp_notified: wpOk })
}
