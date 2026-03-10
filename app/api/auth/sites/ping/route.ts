import { type NextRequest, NextResponse } from 'next/server'
import { authenticatePlugin } from '@/lib/guards'
import { updateSitePing, updateSiteDomain } from '@/lib/storage'

export async function POST(request: NextRequest) {
  const auth = await authenticatePlugin(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  let body: { domain?: string; site_id?: string } = {}
  try { body = await request.json() } catch { body = {} }

  if ('site' in auth) {
    // Per-site project key — site is known from the key
    if (body.domain && body.domain.trim().replace(/\/+$/, '') !== auth.site.domain) {
      await updateSiteDomain(auth.site.site_id, body.domain)
    } else {
      await updateSitePing(auth.site.site_id, null)
    }
    return NextResponse.json({ ok: true })
  }

  // Legacy PLUGIN_SECRET fallback — needs site_id in body
  const { site_id, domain } = body
  if (!site_id) return NextResponse.json({ error: 'site_id required for legacy auth.' }, { status: 400 })
  await updateSitePing(site_id, domain ?? null)
  return NextResponse.json({ ok: true })
}
