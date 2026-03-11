import { type NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import { OAuth2Client } from 'google-auth-library'
import { escapeHtml } from '@/lib/utils'
import type { SessionData } from '@/lib/session'
import { sessionOptions } from '@/lib/session'
import { buildWordPressRedirect } from '@/lib/wp-auth'

const client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI,
)

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code  = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error) {
    return new NextResponse(
      `Google returned an error: ${escapeHtml(String(error))}`,
      { status: 400 },
    )
  }

  if (!code) {
    return new NextResponse('No authorization code received.', { status: 400 })
  }

  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)

  if (state !== session.oauthNonce) {
    return new NextResponse('OAuth state mismatch. Possible CSRF attack.', { status: 400 })
  }

  try {
    const { tokens } = await client.getToken(code)
    client.setCredentials(tokens)

    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token!,
      audience: process.env.GOOGLE_CLIENT_ID,
    })

    const payload = ticket.getPayload()!

    session.googleUser = {
      email:   payload.email!,
      name:    (payload.name ?? '').slice(0, 100),
      picture: payload.picture ?? '',
    }
    session.oauthNonce = undefined

    // Resume pending WordPress SSO auth
    if (session.wpRedirectUri) {
      const wpRedirectUri = session.wpRedirectUri
      const wpState       = session.wpState
      const wpSiteId      = session.wpSiteId
      const ip            = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? request.headers.get('x-real-ip') ?? undefined
      session.wpRedirectUri = undefined
      session.wpState       = undefined
      session.wpSiteId      = undefined
      await session.save()
      return await buildWordPressRedirect(session.googleUser, wpRedirectUri, wpState, wpSiteId, ip)
    }

    await session.save()
    return NextResponse.redirect(new URL('/', request.url))
  } catch (err) {
    console.error('Google OAuth error:', (err as Error).message)
    return new NextResponse('Authentication failed. Check server logs.', { status: 500 })
  }
}
