import { type NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import type { SessionData } from '@/lib/session'
import { sessionOptions } from '@/lib/session'
import { validateEmail } from '@/lib/guards'
import { removeEmail, getEmails } from '@/lib/storage'

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

  await removeEmail(decoded)
  return NextResponse.json({ success: true, emails: await getEmails() })
}
