/**
 * Shared helper: sign an RS256 login JWT and return the WP redirect URL.
 * Used by both /api/auth/wordpress and /api/auth/google/callback.
 */
import { NextResponse } from 'next/server'
import { escapeHtml } from '@/lib/utils'
import { isEmailAllowed } from '@/lib/storage'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'

interface GoogleUser { email: string; name: string; picture: string }

function loadPrivateKey() {
  const raw = process.env.RSA_PRIVATE_KEY
  if (!raw) throw new Error('RSA_PRIVATE_KEY environment variable is not set')
  // Normalise all newline variants and escaped sequences
  const pem = raw
    .replace(/\\n/g, '\n')   // escaped \n  → real newline
    .replace(/\r\n/g, '\n')  // Windows CRLF → LF
    .replace(/\r/g, '\n')    // old Mac CR   → LF
    .trim()
  // Expose first/last chars so we can see if the PEM headers survived
  if (!pem.startsWith('-----BEGIN')) {
    throw new Error(`Key does not start with PEM header. Starts with: ${JSON.stringify(pem.slice(0, 40))}`)
  }
  return crypto.createPrivateKey({ key: pem, format: 'pem' })
}

export async function buildWordPressRedirect(
  googleUser: GoogleUser,
  wpRedirectUri: string,
  wpState: string | undefined,
): Promise<NextResponse> {
  if (!await isEmailAllowed(googleUser.email)) {
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

  const appUrl = process.env.APP_URL
  if (!appUrl) {
    return new NextResponse('APP_URL is not configured.', { status: 500 })
  }

  if (!process.env.RSA_PRIVATE_KEY) {
    return new NextResponse('RSA_PRIVATE_KEY is not set in environment variables.', { status: 500 })
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
    const msg = (err as Error).message
    console.error('JWT signing error:', msg)
    return new NextResponse(`JWT signing failed: ${msg}`, { status: 500 })
  }

  const redirectUrl = new URL(wpRedirectUri)
  redirectUrl.searchParams.set('token', token)
  if (wpState) redirectUrl.searchParams.set('state', wpState)

  return NextResponse.redirect(redirectUrl)
}
