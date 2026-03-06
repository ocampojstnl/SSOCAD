import { type NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import type { SessionData } from '@/lib/session'
import { sessionOptions } from '@/lib/session'
import { timingSafeCompare } from '@/lib/utils'

export async function POST(request: NextRequest) {
  let body: { secret?: string }
  try { body = await request.json() } catch { body = {} }

  const secret   = body.secret ?? ''
  const expected = process.env.ADMIN_SECRET ?? ''

  if (!expected) {
    return NextResponse.json({ error: 'ADMIN_SECRET is not configured.' }, { status: 500 })
  }

  if (!timingSafeCompare(secret, expected)) {
    return NextResponse.json({ error: 'Invalid admin secret.' }, { status: 401 })
  }

  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
  session.isAdmin = true
  await session.save()

  return NextResponse.json({ ok: true })
}
