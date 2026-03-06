import { NextResponse } from 'next/server'
import { type NextRequest } from 'next/server'
import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import type { SessionData } from '@/lib/session'
import { sessionOptions } from '@/lib/session'
import { validateEmail } from '@/lib/guards'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { loadEmails, addEmail } = require('../../../../config/allowedEmails')

async function requireAdmin() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
  return session.isAdmin ? null : NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
}

export async function GET() {
  const deny = await requireAdmin()
  if (deny) return deny
  return NextResponse.json({ emails: loadEmails() })
}

export async function POST(request: NextRequest) {
  const deny = await requireAdmin()
  if (deny) return deny

  let body: { email?: string }
  try { body = await request.json() } catch { body = {} }

  if (!validateEmail(body.email)) {
    return NextResponse.json({ error: 'Valid email required.' }, { status: 400 })
  }

  addEmail(body.email)
  return NextResponse.json({ success: true, emails: loadEmails() })
}
