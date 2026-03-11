/**
 * Trust scoring for Layer 1 (Risk-Based Authentication).
 *
 * Score breakdown (max 110, capped at 100):
 *
 * Individual signals — about this specific device/user:
 *   +35  Exact (IP + fingerprint) match in the verified signal store
 *   +25  Session cookie email agrees with the DB record email
 *
 * Collective signals — compared against ALL past verified developer logins:
 *   +20  This fingerprint has authenticated on 3+ company WP sites
 *   +15  Incoming IP is within /24 of any known developer IP
 *   +10  Current UTC hour is above average in the developer activity window
 *   + 5  HTTP Referer is a known web-development tool domain
 *
 * TRUSTED  → score ≥ 70
 * UNCERTAIN → score  < 70   (Layer 2 required)
 *
 * Collective data is written ONLY from Layer-2-verified logins so the
 * training data can never be polluted by Layer-1 TRUSTED results.
 */

import type { TrustedSignalRecord, DevProfile } from './storage'

// ── Dev-tool referrer domains ─────────────────────────────────────────────────

const DEV_TOOL_DOMAINS = [
  'pagespeed.web.dev',
  'developers.google.com',
  'gtmetrix.com',
  'pingdom.com',
  'webpagetest.org',
  'tinypng.com',
  'squoosh.app',
  'web.dev',
  'validator.w3.org',
  'caniuse.com',
  'bundlephobia.com',
  'npmjs.com',
  'php.net',
  'wordpress.org',
  'wpscan.com',
  'lighthouse',
]

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns the /24 prefix of an IPv4 address, or null for IPv6 / invalid. */
function ipSubnet24(ip: string): string | null {
  const parts = ip.split('.')
  if (parts.length !== 4) return null
  return parts.slice(0, 3).join('.')
}

function isDevToolReferrer(referrer: string): boolean {
  if (!referrer) return false
  try {
    const host = new URL(referrer).hostname.toLowerCase()
    return DEV_TOOL_DOMAINS.some(d => host === d || host.endsWith('.' + d))
  } catch { return false }
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface ScoreInput {
  ip: string
  fingerprint_hash: string
  cookie_user_email: string | null
  referrer?: string
  /** Result of getTrustedSignal(ip, fingerprint_hash) — null if not found. */
  signal: TrustedSignalRecord | null
  /** Full collective developer profile from getDevProfile(). */
  profile: DevProfile
}

export interface ScoreResult {
  score: number
  reasons: string[]
}

export function computeTrustScore(input: ScoreInput): ScoreResult {
  let score = 0
  const reasons: string[] = []
  const { ip, fingerprint_hash, cookie_user_email, referrer, signal, profile } = input

  // ── Individual signals ────────────────────────────────────────────────────

  // Exact (IP + fingerprint) match in verified signal store
  if (signal) {
    score += 35
    reasons.push('exact_fp_ip_match:+35')
  }

  // Session cookie email agrees with DB record
  if (
    signal?.email && cookie_user_email &&
    signal.email.toLowerCase() === cookie_user_email.toLowerCase()
  ) {
    score += 25
    reasons.push('cookie_db_agree:+25')
  }

  // ── Collective signals ────────────────────────────────────────────────────

  // This fingerprint has been seen on 3+ company WP sites
  const fpSites = profile.fingerprint_sites[fingerprint_hash] ?? []
  if (fpSites.length >= 3) {
    score += 20
    reasons.push(`multi_site_dev(${fpSites.length}_sites):+20`)
  }

  // Incoming IP is within /24 of any known developer IP
  const subnet = ipSubnet24(ip)
  if (subnet && profile.ips.some(devIp => ipSubnet24(devIp) === subnet)) {
    score += 15
    reasons.push('ip_subnet_match:+15')
  }

  // Current UTC hour is above average in the developer activity window
  const totalLogins = profile.active_hours.reduce((a, b) => a + b, 0)
  const avgPerHour  = totalLogins / 24
  if (avgPerHour > 0 && profile.active_hours[new Date().getUTCHours()] > avgPerHour) {
    score += 10
    reasons.push('active_hour_window:+10')
  }

  // HTTP Referer is a known developer tool domain
  if (referrer && isDevToolReferrer(referrer)) {
    score += 5
    reasons.push('dev_tool_referrer:+5')
  }

  return { score: Math.min(score, 100), reasons }
}
