import { NextResponse } from 'next/server'
import { type NextRequest } from 'next/server'
import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import type { SessionData } from '@/lib/session'
import { sessionOptions } from '@/lib/session'
import { validateEmail } from '@/lib/guards'
import { getEmails, addEmail } from '@/lib/storage'

async function requireAdmin() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
  return session.isAdmin ? null : NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
}

export async function GET() {
  const deny = await requireAdmin()
  if (deny) return deny
  return NextResponse.json({ emails: await getEmails() })
}

export async function POST(request: NextRequest) {
  const deny = await requireAdmin()
  if (deny) return deny

  let body: { email?: string }
  try { body = await request.json() } catch { body = {} }

  if (!validateEmail(body.email)) {
    return NextResponse.json({ error: 'Valid email required.' }, { status: 400 })
  }

  await addEmail(body.email!)
  return NextResponse.json({ success: true, emails: await getEmails() })
}
