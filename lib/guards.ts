import type { NextRequest } from 'next/server'
import { timingSafeCompare } from './utils'
import { getSiteByProjectKey, type SiteRecord } from './storage'

export function verifyPluginSecret(request: NextRequest): boolean {
  const provided = request.headers.get('x-plugin-secret') ?? ''
  const expected = process.env.PLUGIN_SECRET ?? ''
  if (!expected) return false
  return timingSafeCompare(provided, expected)
}

/**
 * Authenticate an incoming plugin request by project key.
 * - Returns { site } when a valid per-site project key is provided.
 * - Returns { legacy: true } when the shared PLUGIN_SECRET env var matches (fallback).
 * - Returns null when auth fails.
 */
export async function authenticatePlugin(
  request: NextRequest
): Promise<{ site: SiteRecord } | { legacy: true } | null> {
  const key = request.headers.get('x-plugin-secret') ?? ''
  if (!key) return null

  // Primary: per-site project key
  const site = await getSiteByProjectKey(key)
  if (site) {
    if (site.blocked) return null
    return { site }
  }

  // Legacy fallback: shared PLUGIN_SECRET env var
  const legacySecret = process.env.PLUGIN_SECRET ?? ''
  if (legacySecret && timingSafeCompare(key, legacySecret)) {
    return { legacy: true }
  }

  return null
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
