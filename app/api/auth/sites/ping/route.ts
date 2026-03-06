import { type NextRequest, NextResponse } from 'next/server'
import { verifyPluginSecret } from '@/lib/guards'
import { updateSitePing, registerSite } from '@/lib/storage'

export async function POST(request: NextRequest) {
  if (!verifyPluginSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  let body: { site_id?: string; domain?: string }
  try { body = await request.json() } catch { body = {} }

  const { site_id, domain } = body

  if (!site_id || typeof site_id !== 'string') {
    return NextResponse.json({ error: 'site_id required.' }, { status: 400 })
  }

  const site = await updateSitePing(site_id, domain ?? null)

  if (!site && domain) {
    // Not registered yet — register it now
    await registerSite({ site_id, domain, plugin_version: 'unknown' })
  }

  return NextResponse.json({ success: true })
}
