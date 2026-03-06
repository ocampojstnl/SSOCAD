import { type NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import type { SessionData } from '@/lib/session'
import { sessionOptions } from '@/lib/session'
import { buildWordPressRedirect } from '@/lib/wp-auth'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const redirect_uri = searchParams.get('redirect_uri')
  const state        = searchParams.get('state') ?? ''

  if (!redirect_uri) {
    return new NextResponse('Missing redirect_uri parameter.', { status: 400 })
  }

  const allowedOrigins = (process.env.ALLOWED_REDIRECT_ORIGINS ?? '')
    .split(',').map(s => s.trim()).filter(Boolean)

  if (allowedOrigins.length === 0) {
    return new NextResponse('ALLOWED_REDIRECT_ORIGINS is not configured.', { status: 500 })
  }

  let parsedUri: URL
  try { parsedUri = new URL(redirect_uri) }
  catch { return new NextResponse('Invalid redirect_uri.', { status: 400 }) }

  if (!allowedOrigins.includes(parsedUri.origin)) {
    return new NextResponse('redirect_uri origin is not allowed.', { status: 403 })
  }

  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
  session.wpRedirectUri = redirect_uri
  session.wpState       = state

  // Already authenticated with Google? Issue the token immediately.
  if (session.googleUser) {
    const response = buildWordPressRedirect(session.googleUser, redirect_uri, state)
    // Only save if we're not already returning an error response
    await session.save()
    return response
  }

  await session.save()
  return NextResponse.redirect(new URL('/api/auth/google', request.url))
}
