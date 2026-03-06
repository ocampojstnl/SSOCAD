import type { NextRequest } from 'next/server'
import { timingSafeCompare } from './utils'

export function verifyPluginSecret(request: NextRequest): boolean {
  const provided = request.headers.get('x-plugin-secret') ?? ''
  const expected = process.env.PLUGIN_SECRET ?? ''
  if (!expected) return false
  return timingSafeCompare(provided, expected)
}

export function verifyAdminSecret(request: NextRequest): boolean {
  const provided = request.headers.get('x-admin-secret') ?? ''
  const expected = process.env.ADMIN_SECRET ?? ''
  if (!expected) return false
  return timingSafeCompare(provided, expected)
}

export function validateIp(ip: unknown): ip is string {
  return typeof ip === 'string' && ip.length <= 45 && /^[0-9a-fA-F.:]+$/.test(ip)
}

export function validateEmail(email: unknown): email is string {
  return (
    typeof email === 'string' &&
    email.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  )
}
