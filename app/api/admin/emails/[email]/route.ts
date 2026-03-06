import { type NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import type { SessionData } from '@/lib/session'
import { sessionOptions } from '@/lib/session'
import { validateEmail } from '@/lib/guards'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { removeEmail, loadEmails } = require('../../../../../config/allowedEmails')

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ email: string }> },
) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
  if (!session.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const { email } = await params
  const decoded = decodeURIComponent(email)

  if (!validateEmail(decoded)) {
    return NextResponse.json({ error: 'Invalid email format.' }, { status: 400 })
  }

  removeEmail(decoded)
  return NextResponse.json({ success: true, emails: loadEmails() })
}
