import { type NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import type { SessionData } from '@/lib/session'
import { sessionOptions } from '@/lib/session'
import { updateBugReport, deleteBugReport } from '@/lib/storage'

async function isAdmin() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
  return session.isAdmin === true
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await isAdmin()) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const { id } = await params
  let body: Record<string, unknown> = {}
  try { body = await request.json() } catch { body = {} }

  const allowed = ['status', 'title', 'description', 'priority', 'notes', 'type']
  const patch: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) patch[key] = body[key]
  }

  if (Object.keys(patch).length === 0)
    return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 })

  const report = await updateBugReport(id, patch as Parameters<typeof updateBugReport>[1])
  if (!report) return NextResponse.json({ error: 'Report not found.' }, { status: 404 })

  return NextResponse.json({ report })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await isAdmin()) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const { id } = await params
  const deleted = await deleteBugReport(id)
  if (!deleted) return NextResponse.json({ error: 'Report not found.' }, { status: 404 })

  return NextResponse.json({ ok: true })
}
