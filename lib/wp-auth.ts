/**
 * Shared helper: sign an RS256 login JWT and return the WP redirect URL.
 * Used by both /api/auth/wordpress and /api/auth/google/callback.
 */
import { NextResponse } from 'next/server'
import { escapeHtml } from '@/lib/utils'
import { isEmailAllowedForSite, recordFailedAttempt, clearFailedAttempts } from '@/lib/storage'
import { loadPrivateKey } from '@/lib/keys'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'

interface GoogleUser { email: string; name: string; picture: string }

export async function buildWordPressRedirect(
  googleUser: GoogleUser,
  wpRedirectUri: string,
  wpState: string | undefined,
  wpSiteId?: string,
  ip?: string,
): Promise<NextResponse> {
  if (!wpSiteId) {
    try {
      const loginUrl = new URL(wpRedirectUri)
      loginUrl.search = ''
      loginUrl.searchParams.set('cad_dev_login', '1')
      loginUrl.searchParams.set('cad_dev_error', 'Site is not registered with the SSO provider.')
      return NextResponse.redirect(loginUrl)
    } catch {
      return new NextResponse('Site is not registered with the SSO provider.', { status: 403 })
    }
  }

  const allowed = await isEmailAllowedForSite(googleUser.email, wpSiteId)
  if (!allowed) {
    if (ip) await recordFailedAttempt(ip, 'google_sso')
    try {
      const loginUrl = new URL(wpRedirectUri)
      loginUrl.search = ''
      loginUrl.searchParams.set('cad_dev_login', '1')
      loginUrl.searchParams.set('cad_dev_error', `Your email (${googleUser.email}) is not authorized to access this site.`)
      return NextResponse.redirect(loginUrl)
    } catch {
      return new NextResponse(`Access denied: ${escapeHtml(googleUser.email)} is not authorized.`, { status: 403 })
    }
  }

  const appUrl = process.env.APP_URL
  if (!appUrl) return new NextResponse('APP_URL is not configured.', { status: 500 })
  if (!process.env.RSA_PRIVATE_KEY) return new NextResponse('RSA_PRIVATE_KEY is not set.', { status: 500 })

  let token: string
  try {
    const privateKey = loadPrivateKey()
    token = jwt.sign(
      { email: googleUser.email, name: googleUser.name, iss: appUrl, aud: 'wordpress-sso' },
      privateKey,
      { algorithm: 'RS256', expiresIn: '5m', jwtid: crypto.randomBytes(16).toString('hex') },
    )
  } catch (err) {
    const msg = (err as Error).message
    console.error('JWT signing error:', msg)
    return new NextResponse(`JWT signing failed: ${msg}`, { status: 500 })
  }

  // Successful Google SSO — clear any failed attempt counter for this IP
  if (ip) await clearFailedAttempts(ip)

  const redirectUrl = new URL(wpRedirectUri)
  redirectUrl.searchParams.set('token', token)
  if (wpState) redirectUrl.searchParams.set('state', wpState)
  return NextResponse.redirect(redirectUrl)
}
