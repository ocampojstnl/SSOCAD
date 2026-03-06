import { type NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import type { SessionData } from '@/lib/session'
import { sessionOptions } from '@/lib/session'
import { validateEmail } from '@/lib/guards'
import { getNotificationEmail, saveNotificationEmail } from '@/lib/storage'

async function requireAdmin() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
  return session.isAdmin ? null : NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
}

export async function GET() {
  const deny = await requireAdmin()
  if (deny) return deny
  return NextResponse.json({ email: await getNotificationEmail() })
}

export async function POST(request: NextRequest) {
  const deny = await requireAdmin()
  if (deny) return deny

  let body: { email?: string }
  try { body = await request.json() } catch { body = {} }

  if (!validateEmail(body.email)) {
    return NextResponse.json({ error: 'Valid email required.' }, { status: 400 })
  }

  await saveNotificationEmail(body.email!)
  return NextResponse.json({ success: true, email: body.email })
}
