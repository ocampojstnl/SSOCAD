import { NextResponse, type NextRequest } from 'next/server'
import { getIronSession } from 'iron-session'
import { sessionOptions, type SessionData } from '@/lib/session'

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/dashboard')) {
    const response = NextResponse.next()
    const session = await getIronSession<SessionData>(request, response, sessionOptions)
    if (!session.isAdmin) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    return response
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*'],
}
