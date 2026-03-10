/**
 * Persistent storage layer.
 *  - Vercel (KV_REST_API_URL set): uses @vercel/kv (Redis)
 *  - Local dev: uses the filesystem (data/*.json)
 */

import fs from 'fs'
import path from 'path'
import { kv } from '@vercel/kv'

const USE_KV = !!process.env.KV_REST_API_URL
// On Vercel, process.cwd() is not writable — use /tmp instead
const DATA_DIR = process.env.VERCEL
  ? '/tmp/cad-dev-data'
  : path.join(process.cwd(), 'data')

function fsRead<T>(file: string, fallback: T): T {
  try {
    const p = path.join(DATA_DIR, file)
    if (!fs.existsSync(p)) return fallback
    return JSON.parse(fs.readFileSync(p, 'utf8')) as T
  } catch { return fallback }
}

function fsWrite(file: string, data: unknown): void {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
    fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2))
  } catch (e) { console.error(`[storage] write failed (${file}):`, e) }
}

async function kvGet<T>(key: string, fallback: T): Promise<T> {
  try {
    return (await kv.get<T>(key)) ?? fallback
  } catch (e) {
    console.error(`[storage] kvGet failed (${key}):`, e)
    return fallback
  }
}

async function kvSet(key: string, value: unknown): Promise<void> {
  try {
    await kv.set(key, value)
  } catch (e) {
    console.error(`[storage] kvSet failed (${key}):`, e)
  }
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface SiteRecord {
  site_id: string
  domain: string
  owner_email: string | null
  plugin_version: string
  registered_at: string
  last_seen: string
  blocked?: boolean
}

// ── Emails ───────────────────────────────────────────────────────────────────

export async function getEmails(): Promise<string[]> {
  if (USE_KV) return kvGet('emails', [])
  const stored = fsRead<string[]>('allowed-emails.json', [])
  if (stored.length > 0) return stored
  // Seed from env var on cold starts (Vercel /tmp is ephemeral)
  const seed = (process.env.ALLOWED_EMAILS || '')
    .split(',').map(e => e.toLowerCase().trim()).filter(Boolean)
  if (seed.length > 0) fsWrite('allowed-emails.json', seed)
  return seed
}

export async function addEmail(email: string): Promise<void> {
  const list = await getEmails()
  const lower = email.toLowerCase().trim()
  if (list.includes(lower)) return
  const updated = [...list, lower]
  USE_KV ? await kvSet('emails', updated) : fsWrite('allowed-emails.json', updated)
}

export async function removeEmail(email: string): Promise<void> {
  const updated = (await getEmails()).filter(e => e !== email.toLowerCase().trim())
  USE_KV ? await kvSet('emails', updated) : fsWrite('allowed-emails.json', updated)
}

export async function isEmailAllowed(email: string): Promise<boolean> {
  return (await getEmails()).includes(email.toLowerCase().trim())
}

// ── IPs ──────────────────────────────────────────────────────────────────────

export async function getWhitelist(): Promise<string[]> {
  return USE_KV ? kvGet('whitelist', []) : fsRead('ip-whitelist.json', [])
}

export async function getBlacklist(): Promise<string[]> {
  return USE_KV ? kvGet('blacklist', []) : fsRead('ip-blacklist.json', [])
}

export async function addToWhitelist(ip: string): Promise<void> {
  const list = await getWhitelist()
  if (list.includes(ip)) return
  const updated = [...list, ip]
  USE_KV ? await kvSet('whitelist', updated) : fsWrite('ip-whitelist.json', updated)
}

export async function removeFromWhitelist(ip: string): Promise<void> {
  const updated = (await getWhitelist()).filter(x => x !== ip)
  USE_KV ? await kvSet('whitelist', updated) : fsWrite('ip-whitelist.json', updated)
}

export async function addToBlacklist(ip: string): Promise<void> {
  const list = await getBlacklist()
  if (list.includes(ip)) return
  const updated = [...list, ip]
  USE_KV ? await kvSet('blacklist', updated) : fsWrite('ip-blacklist.json', updated)
}

export async function removeFromBlacklist(ip: string): Promise<void> {
  const updated = (await getBlacklist()).filter(x => x !== ip)
  USE_KV ? await kvSet('blacklist', updated) : fsWrite('ip-blacklist.json', updated)
}

export async function isWhitelisted(ip: string): Promise<boolean> {
  return (await getWhitelist()).includes(ip)
}

export async function isBlacklisted(ip: string): Promise<boolean> {
  return (await getBlacklist()).includes(ip)
}

// ── Sites ────────────────────────────────────────────────────────────────────

export async function getSites(): Promise<SiteRecord[]> {
  return USE_KV ? kvGet('sites', []) : fsRead('sites.json', [])
}

async function saveSites(sites: SiteRecord[]): Promise<void> {
  USE_KV ? await kvSet('sites', sites) : fsWrite('sites.json', sites)
}

export async function registerSite(data: {
  site_id: string; domain: string; owner_email?: string | null; plugin_version: string
}): Promise<void> {
  const sites = await getSites()
  const now   = new Date().toISOString()
  const idx   = sites.findIndex(s => s.site_id === data.site_id)
  if (idx >= 0) {
    sites[idx] = {
      ...sites[idx],
      domain: data.domain,
      plugin_version: data.plugin_version,
      ...(data.owner_email ? { owner_email: data.owner_email } : {}),
      last_seen: now,
    }
  } else {
    sites.push({
      site_id: data.site_id,
      domain: data.domain,
      owner_email: data.owner_email ?? null,
      plugin_version: data.plugin_version,
      registered_at: now,
      last_seen: now,
    })
  }
  await saveSites(sites)
}

export async function updateSitePing(site_id: string, domain: string | null): Promise<SiteRecord | null> {
  const sites = await getSites()
  const site  = sites.find(s => s.site_id === site_id)
  if (site) {
    site.last_seen = new Date().toISOString()
    if (domain) site.domain = domain
    await saveSites(sites)
  }
  return site ?? null
}

export async function getSite(site_id: string): Promise<SiteRecord | null> {
  return (await getSites()).find(s => s.site_id === site_id) ?? null
}

export async function setSiteBlocked(site_id: string, blocked: boolean): Promise<SiteRecord | null> {
  const sites = await getSites()
  const site  = sites.find(s => s.site_id === site_id)
  if (site) {
    site.blocked = blocked
    await saveSites(sites)
  }
  return site ?? null
}

// ── Auth Code Requests ───────────────────────────────────────────────────────

export interface AuthCodeRequest {
  id: string
  site_domain: string
  code: string        // 6-digit code — shown to admin so they can relay it
  otp_token: string   // opaque JWT sent back to the plugin
  requested_at: string
  used: boolean
}

export async function getAuthCodeRequests(): Promise<AuthCodeRequest[]> {
  return USE_KV ? kvGet('auth_code_requests', []) : fsRead('auth-code-requests.json', [])
}

export async function addAuthCodeRequest(req: AuthCodeRequest): Promise<void> {
  const list = await getAuthCodeRequests()
  // Keep only the last 200 requests to avoid unbounded growth
  const updated = [req, ...list].slice(0, 200)
  USE_KV ? await kvSet('auth_code_requests', updated) : fsWrite('auth-code-requests.json', updated)
}

export async function markAuthCodeUsed(otp_token: string): Promise<void> {
  const list = await getAuthCodeRequests()
  const idx  = list.findIndex(r => r.otp_token === otp_token)
  if (idx >= 0) {
    list[idx].used = true
    USE_KV ? await kvSet('auth_code_requests', list) : fsWrite('auth-code-requests.json', list)
  }
}

export async function getPendingAuthCodeCount(): Promise<number> {
  const list = await getAuthCodeRequests()
  const tenMinutesAgo = Date.now() - 10 * 60 * 1000
  return list.filter(r => !r.used && new Date(r.requested_at).getTime() > tenMinutesAgo).length
}

// ── Notification Email ───────────────────────────────────────────────────────

export async function getNotificationEmail(): Promise<string> {
  if (USE_KV) {
    const stored = await kvGet<string | null>('notification_email', null)
    return stored ?? process.env.NOTIFICATION_EMAIL ?? ''
  }
  const data = fsRead<{ email?: string }>('notification-email.json', {})
  return data.email ?? process.env.NOTIFICATION_EMAIL ?? ''
}

export async function saveNotificationEmail(email: string): Promise<void> {
  USE_KV ? await kvSet('notification_email', email) : fsWrite('notification-email.json', { email })
}
