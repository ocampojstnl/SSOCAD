import { type NextRequest, NextResponse } from 'next/server'
import { verifyPluginSecret } from '@/lib/guards'
import { saveTrustedSignal } from '@/lib/storage'

export async function POST(request: NextRequest) {
  if (!verifyPluginSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  let body: { ip?: string; fingerprint_hash?: string; email?: string }
  try { body = await request.json() } catch { body = {} }

  const { ip, fingerprint_hash, email } = body

  if (!ip || !fingerprint_hash || !email) {
    return NextResponse.json({ error: 'ip, fingerprint_hash, and email are required.' }, { status: 400 })
  }

  await saveTrustedSignal(ip, fingerprint_hash, email)

  return NextResponse.json({ ok: true })
}
