import { NextRequest, NextResponse } from 'next/server'
import { authenticatePlugin } from '@/lib/guards'
import { loadPublicKey } from '@/lib/keys'

/**
 * GET /api/auth/verify
 *
 * Called by the WordPress plugin after the admin saves settings.
 * Validates the project key AND returns the web app's RSA public key so the
 * plugin can confirm it matches what is stored locally.
 * Only marks itself verified (and hides) when both the key AND the public key match.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticatePlugin(request)
  if (!auth) {
    return NextResponse.json({ ok: false, error: 'Invalid project key or plugin secret.' }, { status: 401 })
  }

  let public_key: string
  try {
    public_key = loadPublicKey()
  } catch {
    return NextResponse.json({ ok: false, error: 'RSA public key not configured on server.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, public_key })
}
