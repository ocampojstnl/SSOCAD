import { type NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import type { SessionData } from '@/lib/session'
import { sessionOptions } from '@/lib/session'
import { unbanIP } from '@/lib/storage'

async function requireAdmin() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
  return session.isAdmin ? null : NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ ip: string }> },
) {
  const deny = await requireAdmin()
  if (deny) return deny

  const { ip } = await params
  const unbanned = await unbanIP(decodeURIComponent(ip))
  if (!unbanned) {
    return NextResponse.json({ error: 'No active ban found for this IP.' }, { status: 404 })
  }
  return NextResponse.json({ success: true })
}
