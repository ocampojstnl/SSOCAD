/**
 * Persistent storage layer.
 *  - Vercel (KV_REST_API_URL set): uses @vercel/kv (Redis)
 *  - Local dev: uses the filesystem (data/*.json)
 */

import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
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
  project_key?: string      // per-site authentication key (admin-generated)
  allowed_emails?: string[] // per-site email allowlist (supplements global list)
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

// ── Per-site email allowlist ──────────────────────────────────────────────────

export async function addSiteEmail(site_id: string, email: string): Promise<SiteRecord | null> {
  const sites = await getSites()
  const site = sites.find(s => s.site_id === site_id)
  if (!site) return null
  const lower = email.toLowerCase().trim()
  if (!site.allowed_emails) site.allowed_emails = []
  if (!site.allowed_emails.includes(lower)) {
    site.allowed_emails.push(lower)
    await saveSites(sites)
  }
  return site
}

export async function removeSiteEmail(site_id: string, email: string): Promise<SiteRecord | null> {
  const sites = await getSites()
  const site = sites.find(s => s.site_id === site_id)
  if (!site) return null
  site.allowed_emails = (site.allowed_emails ?? []).filter(
    e => e !== email.toLowerCase().trim()
  )
  await saveSites(sites)
  return site
}

/**
 * Check if an email is allowed to access a specific site.
 * If the site has a per-site allowlist configured, it is the exclusive whitelist —
 * only those emails can access that site (super-admins included must be listed).
 * If no per-site list is configured, falls back to the global allowed-emails list.
 */
export async function isEmailAllowedForSite(email: string, site_id: string): Promise<boolean> {
  const lower = email.toLowerCase().trim()
  const site = await getSite(site_id)
  if (site?.allowed_emails && site.allowed_emails.length > 0) {
    return site.allowed_emails.map(e => e.toLowerCase()).includes(lower)
  }
  return isEmailAllowed(lower)
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

export function generateProjectKey(): string {
  return `cad_${crypto.randomBytes(20).toString('hex')}`
}

export async function getSiteByProjectKey(key: string): Promise<SiteRecord | null> {
  return (await getSites()).find(s => s.project_key === key) ?? null
}

/** Admin creates a site manually — generates a project key immediately. */
export async function createSiteByAdmin(domain: string): Promise<SiteRecord> {
  const sites = await getSites()
  const now = new Date().toISOString()
  const site_id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
  const site: SiteRecord = {
    site_id,
    domain: domain.trim().replace(/\/+$/, ''),
    owner_email: null,
    plugin_version: 'unknown',
    registered_at: now,
    last_seen: now,
    project_key: generateProjectKey(),
  }
  sites.push(site)
  await saveSites(sites)
  return site
}

/** Generate a project key for an existing site that doesn't have one yet. */
export async function assignProjectKey(site_id: string): Promise<SiteRecord | null> {
  const sites = await getSites()
  const site = sites.find(s => s.site_id === site_id)
  if (site && !site.project_key) {
    site.project_key = generateProjectKey()
    await saveSites(sites)
  }
  return site ?? null
}

export async function updateSiteDomain(site_id: string, domain: string): Promise<SiteRecord | null> {
  const sites = await getSites()
  const site = sites.find(s => s.site_id === site_id)
  if (site) {
    site.domain = domain.trim().replace(/\/+$/, '')
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

// ── Trusted Signals ──────────────────────────────────────────────────────────

export interface TrustedSignalRecord {
  ip: string
  fingerprint_hash: string
  email: string
  first_seen: string
  last_seen: string
  login_count: number
}

export async function getTrustedSignals(): Promise<TrustedSignalRecord[]> {
  return USE_KV ? kvGet('trusted_signals', []) : fsRead('trusted-signals.json', [])
}

async function saveTrustedSignals(signals: TrustedSignalRecord[]): Promise<void> {
  USE_KV ? await kvSet('trusted_signals', signals) : fsWrite('trusted-signals.json', signals)
}

export async function getTrustedSignal(ip: string, fingerprint_hash: string): Promise<TrustedSignalRecord | null> {
  const signals = await getTrustedSignals()
  return signals.find(s => s.ip === ip && s.fingerprint_hash === fingerprint_hash) ?? null
}

export async function saveTrustedSignal(ip: string, fingerprint_hash: string, email: string): Promise<void> {
  const signals = await getTrustedSignals()
  const now = new Date().toISOString()
  const idx = signals.findIndex(s => s.ip === ip && s.fingerprint_hash === fingerprint_hash)
  if (idx >= 0) {
    signals[idx].last_seen = now
    signals[idx].login_count = (signals[idx].login_count ?? 0) + 1
    signals[idx].email = email
  } else {
    signals.push({ ip, fingerprint_hash, email, first_seen: now, last_seen: now, login_count: 1 })
  }
  await saveTrustedSignals(signals)
}

/**
 * Delete trusted signals.
 * @param email  If provided, delete only signals for that email. Otherwise delete all.
 * @returns Number of records deleted.
 */
export async function deleteTrustedSignals(email?: string): Promise<number> {
  const signals = await getTrustedSignals()
  const before = signals.length
  const updated = email
    ? signals.filter(s => s.email.toLowerCase() !== email.toLowerCase())
    : []
  await saveTrustedSignals(updated)
  return before - updated.length
}

// ── Login Sessions ───────────────────────────────────────────────────────────

export interface LoginSession {
  id: string
  site_id: string
  email: string
  login_at: string
  logout_at?: string
  status: 'active' | 'signed_out'
}

export async function getLoginSessions(site_id?: string): Promise<LoginSession[]> {
  const all: LoginSession[] = USE_KV
    ? await kvGet('login_sessions', [])
    : fsRead('login-sessions.json', [])
  return site_id ? all.filter(s => s.site_id === site_id) : all
}

async function saveLoginSessions(sessions: LoginSession[]): Promise<void> {
  USE_KV ? await kvSet('login_sessions', sessions) : fsWrite('login-sessions.json', sessions)
}

export async function addLoginSession(site_id: string, email: string): Promise<void> {
  const all = await getLoginSessions()
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
  const now = new Date().toISOString()
  const updated = [
    { id, site_id, email: email.toLowerCase(), login_at: now, status: 'active' as const },
    ...all,
  ].slice(0, 1000)
  await saveLoginSessions(updated)
}

export async function markSessionLoggedOut(site_id: string, email: string): Promise<void> {
  const all = await getLoginSessions()
  const now = new Date().toISOString()
  const idx = all.findIndex(
    s => s.site_id === site_id && s.email === email.toLowerCase() && s.status === 'active'
  )
  if (idx >= 0) {
    all[idx].status = 'signed_out'
    all[idx].logout_at = now
    await saveLoginSessions(all)
  }
}

// ── Bug Reports / Feature Requests ───────────────────────────────────────────

export type BugStatus   = 'backlog' | 'active' | 'done' | 'denied'
export type BugType     = 'bug' | 'feature'
export type BugPriority = 'low' | 'medium' | 'high'

export interface BugReport {
  id: string
  type: BugType
  title: string
  description: string
  priority: BugPriority
  status: BugStatus
  notes?: string
  created_at: string
  updated_at: string
}

export async function getBugReports(): Promise<BugReport[]> {
  return USE_KV ? kvGet('bug_reports', []) : fsRead('bug-reports.json', [])
}

async function saveBugReports(reports: BugReport[]): Promise<void> {
  USE_KV ? await kvSet('bug_reports', reports) : fsWrite('bug-reports.json', reports)
}

export async function addBugReport(data: {
  type: BugType; title: string; description: string; priority: BugPriority
}): Promise<BugReport> {
  const reports = await getBugReports()
  const now = new Date().toISOString()
  const report: BugReport = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    type: data.type,
    title: data.title.trim(),
    description: data.description.trim(),
    priority: data.priority,
    status: 'backlog',
    created_at: now,
    updated_at: now,
  }
  await saveBugReports([report, ...reports])
  return report
}

export async function updateBugReport(
  id: string,
  patch: Partial<Pick<BugReport, 'status' | 'title' | 'description' | 'priority' | 'notes' | 'type'>>
): Promise<BugReport | null> {
  const reports = await getBugReports()
  const idx = reports.findIndex(r => r.id === id)
  if (idx < 0) return null
  reports[idx] = { ...reports[idx], ...patch, updated_at: new Date().toISOString() }
  await saveBugReports(reports)
  return reports[idx]
}

export async function deleteBugReport(id: string): Promise<boolean> {
  const reports = await getBugReports()
  const filtered = reports.filter(r => r.id !== id)
  if (filtered.length === reports.length) return false
  await saveBugReports(filtered)
  return true
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
