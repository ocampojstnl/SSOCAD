import { type NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import type { SessionData } from '@/lib/session'
import { sessionOptions } from '@/lib/session'
import { validateIp } from '@/lib/guards'
import { getBlacklist, addToBlacklist } from '@/lib/storage'

async function requireAdmin() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
  return session.isAdmin ? null : NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
}

export async function GET() {
  const deny = await requireAdmin()
  if (deny) return deny
  return NextResponse.json({ ips: await getBlacklist() })
}

export async function POST(request: NextRequest) {
  const deny = await requireAdmin()
  if (deny) return deny

  let body: { ip?: unknown }
  try { body = await request.json() } catch { body = {} }

  if (!validateIp(body.ip)) {
    return NextResponse.json({ error: 'Valid IP address required.' }, { status: 400 })
  }

  await addToBlacklist(body.ip as string)
  return NextResponse.json({ success: true, ips: await getBlacklist() })
}
