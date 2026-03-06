import { type NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import type { SessionData } from '@/lib/session'
import { sessionOptions } from '@/lib/session'
import { validateIp } from '@/lib/guards'
import { removeFromBlacklist, getBlacklist } from '@/lib/storage'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ ip: string }> },
) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
  if (!session.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const { ip } = await params
  const decoded = decodeURIComponent(ip)

  if (!validateIp(decoded)) {
    return NextResponse.json({ error: 'Invalid IP.' }, { status: 400 })
  }

  await removeFromBlacklist(decoded)
  return NextResponse.json({ success: true, ips: await getBlacklist() })
}
