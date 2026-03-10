import { type NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import type { SessionData } from '@/lib/session'
import { sessionOptions } from '@/lib/session'
import { getBugReports, addBugReport, type BugType, type BugPriority } from '@/lib/storage'

async function isAdmin() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions)
  return session.isAdmin === true
}

export async function GET() {
  if (!await isAdmin()) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  const reports = await getBugReports()
  return NextResponse.json({ reports })
}

export async function POST(request: NextRequest) {
  if (!await isAdmin()) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  let body: { type?: string; title?: string; description?: string; priority?: string } = {}
  try { body = await request.json() } catch { body = {} }

  const { type, title, description, priority } = body

  if (!type || !['bug', 'feature'].includes(type))
    return NextResponse.json({ error: 'type must be "bug" or "feature".' }, { status: 400 })
  if (!title?.trim())
    return NextResponse.json({ error: 'title is required.' }, { status: 400 })
  if (!description?.trim())
    return NextResponse.json({ error: 'description is required.' }, { status: 400 })
  if (!priority || !['low', 'medium', 'high'].includes(priority))
    return NextResponse.json({ error: 'priority must be low, medium, or high.' }, { status: 400 })

  const report = await addBugReport({
    type: type as BugType,
    title,
    description,
    priority: priority as BugPriority,
  })

  return NextResponse.json({ report }, { status: 201 })
}
