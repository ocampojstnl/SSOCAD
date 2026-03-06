import { NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import type { SessionData } from '@/lib/session'
import { sessionOptions } from '@/lib/session'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { loadPublicKey } = require('../../../../config/keys')

export async function GET() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
  if (!session.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  try {
    return NextResponse.json({ public_key: loadPublicKey() })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
