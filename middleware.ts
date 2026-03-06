import { NextResponse, type NextRequest } from 'next/server'
import { unsealData } from 'iron-session'
import { type SessionData } from '@/lib/session'

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/dashboard')) {
    const cookieValue = request.cookies.get('cad_dev_sid')?.value
    if (!cookieValue) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    try {
      const session = await unsealData<SessionData>(cookieValue, {
        password: process.env.SESSION_SECRET as string,
      })
      if (!session.isAdmin) {
        return NextResponse.redirect(new URL('/login', request.url))
      }
    } catch {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*'],
}
