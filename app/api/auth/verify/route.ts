import { NextRequest, NextResponse } from 'next/server'
import { authenticatePlugin } from '@/lib/guards'

/**
 * GET /api/auth/verify
 *
 * Called by the WordPress plugin after the admin saves settings.
 * Validates the project key (or legacy plugin secret) and returns 200 if
 * correct, 401 if not. The plugin uses this to decide whether to mark itself
 * as verified (and hide from non-SSO users) or stay visible for reconfiguration.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticatePlugin(request)
  if (!auth) {
    return NextResponse.json({ ok: false, error: 'Invalid credentials.' }, { status: 401 })
  }
  return NextResponse.json({ ok: true })
}
