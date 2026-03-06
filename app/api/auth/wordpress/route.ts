import { type NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import type { SessionData } from '@/lib/session'
import { sessionOptions } from '@/lib/session'
import { buildWordPressRedirect } from '@/lib/wp-auth'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { loadSites } = require('../../../../config/sites')

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const redirect_uri = searchParams.get('redirect_uri')
  const state        = searchParams.get('state') ?? ''

  if (!redirect_uri) {
    return new NextResponse('Missing redirect_uri parameter.', { status: 400 })
  }

  let parsedUri: URL
  try { parsedUri = new URL(redirect_uri) }
  catch { return new NextResponse('Invalid redirect_uri.', { status: 400 }) }

  const sites: { domain: string; blocked?: boolean }[] = loadSites()
  const matchingSite = sites.find(s => {
    try { return new URL(s.domain).origin === parsedUri.origin } catch { return false }
  })

  if (!matchingSite) {
    return new NextResponse('This site is not registered. Install and activate the plugin first.', { status: 403 })
  }
  if (matchingSite.blocked) {
    return new NextResponse('This site has been blocked by the administrator.', { status: 403 })
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
