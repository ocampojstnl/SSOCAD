import { type NextRequest, NextResponse } from 'next/server'
import { verifyPluginSecret } from '@/lib/guards'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { registerSite } = require('../../../../../config/sites')

export async function POST(request: NextRequest) {
  if (!verifyPluginSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  let body: { site_id?: string; domain?: string; owner_email?: string; plugin_version?: string }
  try { body = await request.json() } catch { body = {} }

  const { site_id, domain, owner_email, plugin_version } = body

  if (!site_id || typeof site_id !== 'string' || site_id.length > 64) {
    return NextResponse.json({ error: 'Valid site_id required.' }, { status: 400 })
  }
  if (!domain || typeof domain !== 'string') {
    return NextResponse.json({ error: 'domain required.' }, { status: 400 })
  }
  try { new URL(domain) } catch {
    return NextResponse.json({ error: 'Invalid domain URL.' }, { status: 400 })
  }
  if (owner_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(owner_email)) {
    return NextResponse.json({ error: 'Invalid owner_email.' }, { status: 400 })
  }

  registerSite({
    site_id,
    domain,
    owner_email: owner_email || null,
    plugin_version: plugin_version || 'unknown',
  })

  return NextResponse.json({ success: true })
}
