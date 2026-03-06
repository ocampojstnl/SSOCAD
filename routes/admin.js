const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

const jwt    = require('jsonwebtoken');
const crypto = require('crypto');

const { loadEmails, addEmail, removeEmail } = require('../config/allowedEmails');
const { loadPublicKey, loadPrivateKey } = require('../config/keys');
const { loadNotificationEmail, saveNotificationEmail } = require('../config/notificationEmail');
const {
  loadWhitelist, loadBlacklist,
  addToWhitelist, removeFromWhitelist,
  addToBlacklist, removeFromBlacklist,
} = require('../config/ipLists');
const { loadSites, getSite } = require('../config/sites');

// Tight rate limit on admin endpoints — 30 requests per 15 min per IP
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests.' }
});

router.use(adminLimiter);
router.use(express.json({ limit: '16kb' }));

/**
 * Protect all admin routes with the ADMIN_SECRET header.
 * - Header only (never query param — query params leak into server logs and referrer headers)
 * - Timing-safe comparison to prevent timing attacks
 */
function requireAdminSecret(req, res, next) {
  const provided = req.headers['x-admin-secret'] || '';
  const expected = process.env.ADMIN_SECRET || '';

  if (!expected) {
    return res.status(500).json({ error: 'ADMIN_SECRET is not configured on the server.' });
  }

  // Timing-safe comparison — both buffers must be same length
  let valid = false;
  try {
    const a = Buffer.from(provided.padEnd(expected.length));
    const b = Buffer.from(expected);
    valid = provided.length === expected.length && crypto.timingSafeEqual(a, b);
  } catch {
    valid = false;
  }

  if (!valid) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  next();
}

router.use(requireAdminSecret);

/** GET /admin/emails — list all allowed emails */
router.get('/emails', (req, res) => {
  res.json({ emails: loadEmails() });
});

/** POST /admin/emails — add an email */
router.post('/emails', (req, res) => {
  const { email } = req.body;
  if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Valid email required.' });
  }
  if (email.length > 254) {
    return res.status(400).json({ error: 'Email too long.' });
  }
  addEmail(email);
  res.json({ success: true, emails: loadEmails() });
});

/** DELETE /admin/emails/:email — remove an email */
router.delete('/emails/:email', (req, res) => {
  const email = decodeURIComponent(req.params.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email format.' });
  }
  removeEmail(email);
  res.json({ success: true, emails: loadEmails() });
});

/** GET /admin/notification-email — get the current notification email */
router.get('/notification-email', (req, res) => {
  res.json({ email: loadNotificationEmail() });
});

/** POST /admin/notification-email — set the notification email */
router.post('/notification-email', (req, res) => {
  const { email } = req.body;
  if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Valid email required.' });
  }
  if (email.length > 254) {
    return res.status(400).json({ error: 'Email too long.' });
  }
  saveNotificationEmail(email);
  res.json({ success: true, email });
});

/** GET /admin/public-key — return the RSA public key (for pasting into WP plugin) */
router.get('/public-key', (req, res) => {
  try {
    res.json({ public_key: loadPublicKey() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── IP Whitelist ──────────────────────────────────────────────────────────────

function validateIp(ip) {
  // Accept IPv4 and IPv6
  return typeof ip === 'string' && ip.length <= 45 &&
    /^[0-9a-fA-F.:]+$/.test(ip);
}

/** GET /admin/ips/whitelist */
router.get('/ips/whitelist', (req, res) => {
  res.json({ ips: loadWhitelist() });
});

/** POST /admin/ips/whitelist — body: { ip } */
router.post('/ips/whitelist', (req, res) => {
  const { ip } = req.body;
  if (!validateIp(ip)) return res.status(400).json({ error: 'Valid IP address required.' });
  addToWhitelist(ip);
  res.json({ success: true, ips: loadWhitelist() });
});

/** DELETE /admin/ips/whitelist/:ip */
router.delete('/ips/whitelist/:ip', (req, res) => {
  const ip = decodeURIComponent(req.params.ip);
  if (!validateIp(ip)) return res.status(400).json({ error: 'Invalid IP.' });
  removeFromWhitelist(ip);
  res.json({ success: true, ips: loadWhitelist() });
});

// ── IP Blacklist ──────────────────────────────────────────────────────────────

/** GET /admin/ips/blacklist */
router.get('/ips/blacklist', (req, res) => {
  res.json({ ips: loadBlacklist() });
});

/** POST /admin/ips/blacklist — body: { ip } */
router.post('/ips/blacklist', (req, res) => {
  const { ip } = req.body;
  if (!validateIp(ip)) return res.status(400).json({ error: 'Valid IP address required.' });
  addToBlacklist(ip);
  res.json({ success: true, ips: loadBlacklist() });
});

/** DELETE /admin/ips/blacklist/:ip */
router.delete('/ips/blacklist/:ip', (req, res) => {
  const ip = decodeURIComponent(req.params.ip);
  if (!validateIp(ip)) return res.status(400).json({ error: 'Invalid IP.' });
  removeFromBlacklist(ip);
  res.json({ success: true, ips: loadBlacklist() });
});

// ── Registered Sites ─────────────────────────────────────────────────────────

/** GET /admin/sites — list all registered sites */
router.get('/sites', (req, res) => {
  res.json({ sites: loadSites() });
});

/**
 * GET /admin/sites/:site_id/push-login
 *
 * Generates a short-lived push-login URL for the specified site.
 * The admin opens the returned push_url in their browser — the WP plugin
 * receives the token, verifies it, and logs the owner in automatically.
 *
 * Returns: { push_url, expires_in: 120 }
 */
router.get('/sites/:site_id/push-login', (req, res) => {
  const site = getSite(req.params.site_id);

  if (!site) {
    return res.status(404).json({ error: 'Site not found.' });
  }
  if (!site.owner_email) {
    return res.status(409).json({ error: 'Site has no owner email on record. The owner must log in via SSO at least once.' });
  }
  if (!site.domain) {
    return res.status(409).json({ error: 'Site has no domain on record.' });
  }

  try {
    const privateKey = loadPrivateKey();
    const appUrl     = process.env.APP_URL;
    if (!appUrl) throw new Error('APP_URL is not set');

    // Push-login token — RS256, 2-minute expiry, distinct audience
    const push_token = jwt.sign(
      {
        email: site.owner_email,
        iss:   appUrl,
        aud:   'push-login',
      },
      privateKey,
      {
        algorithm: 'RS256',
        expiresIn: '2m',
        jwtid: crypto.randomBytes(16).toString('hex'),
      }
    );

    const push_url = `${site.domain.replace(/\/$/, '')}/?cad_dev_push_login=${encodeURIComponent(push_token)}`;

    res.json({ push_url, expires_in: 120 });
  } catch (err) {
    console.error('Push-login JWT error:', err.message);
    res.status(500).json({ error: 'Failed to generate push-login token.' });
  }
});

module.exports = router;
