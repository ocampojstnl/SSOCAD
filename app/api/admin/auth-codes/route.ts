import { NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import type { SessionData } from '@/lib/session'
import { sessionOptions } from '@/lib/session'
import { getAuthCodeRequests, getPendingAuthCodeCount } from '@/lib/storage'

async function requireAdmin() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
  return session.isAdmin ? null : NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
}

export async function GET() {
  const deny = await requireAdmin()
  if (deny) return deny

  const [requests, pendingCount] = await Promise.all([
    getAuthCodeRequests(),
    getPendingAuthCodeCount(),
  ])

  return NextResponse.json({ requests, pendingCount })
}
