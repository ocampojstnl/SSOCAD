import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import type { SessionData } from '@/lib/session'
import { sessionOptions } from '@/lib/session'
import { getLoginSessions } from '@/lib/storage'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ site_id: string }> }
) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
  if (!session.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const { site_id } = await params
  const sessions = await getLoginSessions(site_id)
  return NextResponse.json({ sessions })
}
