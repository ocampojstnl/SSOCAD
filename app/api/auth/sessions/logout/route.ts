import { NextRequest, NextResponse } from 'next/server'
import { markSessionLoggedOut } from '@/lib/storage'

export async function POST(request: NextRequest) {
  const pluginSecret = process.env.PLUGIN_SECRET
  if (!pluginSecret || request.headers.get('x-plugin-secret') !== pluginSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const { site_id, email } = body
  if (!site_id || !email) {
    return NextResponse.json({ error: 'site_id and email are required' }, { status: 400 })
  }

  await markSessionLoggedOut(site_id, email)
  return NextResponse.json({ ok: true })
}
