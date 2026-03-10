import { NextRequest, NextResponse } from 'next/server'
import { authenticatePlugin } from '@/lib/guards'
import { addLoginSession } from '@/lib/storage'

export async function POST(request: NextRequest) {
  const auth = await authenticatePlugin(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!('site' in auth)) return NextResponse.json({ error: 'Per-site project key required for session tracking.' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const { email } = body
  if (!email) return NextResponse.json({ error: 'email is required' }, { status: 400 })

  await addLoginSession(auth.site.site_id, email)
  return NextResponse.json({ ok: true })
}
