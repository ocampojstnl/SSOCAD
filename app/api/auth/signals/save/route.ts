import { type NextRequest, NextResponse } from 'next/server'
import { authenticatePlugin } from '@/lib/guards'
import { saveTrustedSignal, recordVerifiedLogin } from '@/lib/storage'

export async function POST(request: NextRequest) {
  const auth = await authenticatePlugin(request)
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const site_id = 'site' in auth ? auth.site.site_id : null

  let body: { ip?: string; fingerprint_hash?: string; email?: string }
  try { body = await request.json() } catch { body = {} }

  const { ip, fingerprint_hash, email } = body

  if (!ip || !fingerprint_hash || !email) {
    return NextResponse.json({ error: 'ip, fingerprint_hash, and email are required.' }, { status: 400 })
  }

  // Save the individual trusted signal (used for exact fp+IP match in scoring)
  await saveTrustedSignal(ip, fingerprint_hash, email)

  // Feed the collective developer profile (used for /24, multi-site, active-hours scoring)
  // This is always from a Layer-2-verified login — never from Layer 1 — keeping data clean.
  await recordVerifiedLogin(ip, fingerprint_hash, site_id)

  return NextResponse.json({ ok: true })
}
