/**
 * Shared helper: sign an RS256 login JWT and return the WP redirect URL.
 * Used by both /api/auth/wordpress and /api/auth/google/callback.
 */
import { NextResponse } from 'next/server'
import { escapeHtml } from '@/lib/utils'

interface GoogleUser { email: string; name: string; picture: string }

export function buildWordPressRedirect(
  googleUser: GoogleUser,
  wpRedirectUri: string,
  wpState: string | undefined,
): NextResponse {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { isEmailAllowed } = require('../config/allowedEmails')

  if (!isEmailAllowed(googleUser.email)) {
    const html = `<!DOCTYPE html>
<html>
  <head><title>Access Denied — Cad Dev SSO</title></head>
  <body style="font-family:sans-serif;max-width:500px;margin:80px auto;text-align:center">
    <h2>Access Denied</h2>
    <p>Your email <strong>${escapeHtml(googleUser.email)}</strong> is not authorized.</p>
    <p>Contact your administrator to be added to the allowed list.</p>
  </body>
</html>`
    return new NextResponse(html, { status: 403, headers: { 'Content-Type': 'text/html' } })
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const jwt    = require('jsonwebtoken')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const crypto = require('crypto')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { loadPrivateKey } = require('../config/keys')

  const appUrl = process.env.APP_URL
  if (!appUrl) {
    return new NextResponse('APP_URL is not configured.', { status: 500 })
  }

  let token: string
  try {
    const privateKey = loadPrivateKey()
    token = jwt.sign(
      { email: googleUser.email, name: googleUser.name, iss: appUrl, aud: 'wordpress-sso' },
      privateKey,
      { algorithm: 'RS256', expiresIn: '5m', jwtid: crypto.randomBytes(16).toString('hex') },
    )
  } catch (err) {
    console.error('JWT signing error:', (err as Error).message)
    return new NextResponse('Failed to issue authentication token.', { status: 500 })
  }

  const redirectUrl = new URL(wpRedirectUri)
  redirectUrl.searchParams.set('token', token)
  if (wpState) redirectUrl.searchParams.set('state', wpState)

  return NextResponse.redirect(redirectUrl)
}
