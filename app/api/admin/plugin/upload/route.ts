import { NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import { sessionOptions, type SessionData } from '@/lib/session'
import { writeFileSync, mkdirSync } from 'fs'
import path from 'path'

export async function POST(request: Request) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
  if (!session.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get('plugin') as File | null

  if (!file) {
    return NextResponse.json({ error: 'No file provided.' }, { status: 400 })
  }
  if (!file.name.endsWith('.zip')) {
    return NextResponse.json({ error: 'Only .zip files are allowed.' }, { status: 400 })
  }

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  const dir = path.join(process.cwd(), 'public', 'downloadables', 'plugin')
  mkdirSync(dir, { recursive: true })
  writeFileSync(path.join(dir, 'cad-dev.zip'), buffer)

  return NextResponse.json({ ok: true })
}
