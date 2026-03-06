const express = require('express');
const router  = express.Router();
router.use(express.json({ limit: '16kb' }));
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

const { loadPrivateKey } = require('../config/keys');
const { isEmailAllowed } = require('../config/allowedEmails');
const { loadNotificationEmail } = require('../config/notificationEmail');
const { sendOtpEmail } = require('../config/mailer');
const { isWhitelisted, isBlacklisted } = require('../config/ipLists');
const { registerSite, updateSitePing } = require('../config/sites');

const client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Strict rate limit on the auth entry point — 20 attempts per 10 min per IP
const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again later.' }
});

/**
 * Entry point called by the WordPress plugin.
 * Query params:
 *   redirect_uri - where to send the token after auth
 *   state        - opaque value from the plugin (CSRF protection)
 */
router.get('/wordpress', authLimiter, (req, res) => {
  const { redirect_uri, state } = req.query;

  if (!redirect_uri) {
    return res.status(400).send('Missing redirect_uri parameter.');
  }

  // Validate redirect_uri against exact-origin allowlist
  const allowedOrigins = (process.env.ALLOWED_REDIRECT_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  if (allowedOrigins.length === 0) {
    return res.status(500).send('ALLOWED_REDIRECT_ORIGINS is not configured.');
  }

  let parsedUri;
  try {
    parsedUri = new URL(redirect_uri);
  } catch {
    return res.status(400).send('Invalid redirect_uri.');
  }

  // Exact origin match — prevents https://allowed.com.evil.com bypass
  if (!allowedOrigins.includes(parsedUri.origin)) {
    return res.status(403).send('redirect_uri origin is not allowed.');
  }

  // Store the pending WordPress auth request in session
  req.session.wp_redirect_uri = redirect_uri;
  req.session.wp_state = state || '';

  // Already authenticated with Google? Go straight to issuing the token.
  if (req.session.google_user) {
    return proceedWithWordPressAuth(req, res);
  }

  // Otherwise start Google OAuth flow
  res.redirect('/auth/google');
});

/**
 * Initiates the Google OAuth flow.
 */
router.get('/google', authLimiter, (req, res) => {
  const nonce = crypto.randomBytes(16).toString('hex');
  req.session.oauth_nonce = nonce;

  const authUrl = client.generateAuthUrl({
    access_type: 'online',
    scope: ['email', 'profile'],
    state: nonce,
    prompt: 'select_account'
  });

  res.redirect(authUrl);
});

/**
 * Google OAuth callback.
 */
router.get('/google/callback', async (req, res) => {
  const { code, state, error } = req.query;

  // Fix: escape the error value — never reflect raw query params into HTML
  if (error) {
    return res.status(400).send(`Google returned an error: ${escapeHtml(String(error))}`);
  }

  if (!code) {
    return res.status(400).send('No authorization code received.');
  }

  if (state !== req.session.oauth_nonce) {
    return res.status(400).send('OAuth state mismatch. Possible CSRF attack.');
  }

  try {
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();

    // Only store what we need — never store raw token payloads
    req.session.google_user = {
      email: payload.email,
      name: (payload.name || '').slice(0, 100), // cap length
      picture: payload.picture
    };
    delete req.session.oauth_nonce;

    // Resume any pending WordPress SSO auth
    if (req.session.wp_redirect_uri) {
      return proceedWithWordPressAuth(req, res);
    }

    res.redirect('/');
  } catch (err) {
    console.error('Google OAuth error:', err.message);
    res.status(500).send('Authentication failed. Check server logs.');
  }
});

/**
 * Logout — clears the session.
 */
router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

/**
 * Issues a signed JWT and redirects back to the WordPress plugin.
 */
async function proceedWithWordPressAuth(req, res) {
  const { google_user, wp_redirect_uri, wp_state } = req.session;

  if (!google_user) {
    return res.redirect('/auth/google');
  }

  if (!isEmailAllowed(google_user.email)) {
    return res.status(403).send(`
      <!DOCTYPE html>
      <html>
        <head><title>Access Denied - Cad Dev SSO</title></head>
        <body style="font-family:sans-serif;max-width:500px;margin:80px auto;text-align:center">
          <h2>Access Denied</h2>
          <p>Your email <strong>${escapeHtml(google_user.email)}</strong> is not authorized.</p>
          <p>Contact your administrator to be added to the allowed list.</p>
          <a href="/auth/logout">Sign out</a>
        </body>
      </html>
    `);
  }

  try {
    const privateKey = loadPrivateKey();
    const appUrl = process.env.APP_URL;
    if (!appUrl) throw new Error('APP_URL is not set');

    const token = jwt.sign(
      {
        email: google_user.email,
        name: google_user.name,
        iss: appUrl,
        aud: 'wordpress-sso'
      },
      privateKey,
      {
        algorithm: 'RS256',
        expiresIn: '5m',
        jwtid: crypto.randomBytes(16).toString('hex') // tracked on WP side to prevent replay
      }
    );

    // Clear the pending auth from session
    delete req.session.wp_redirect_uri;
    delete req.session.wp_state;

    const redirectUrl = new URL(wp_redirect_uri);
    redirectUrl.searchParams.set('token', token);
    if (wp_state) {
      redirectUrl.searchParams.set('state', wp_state);
    }

    res.redirect(redirectUrl.toString());
  } catch (err) {
    console.error('JWT signing error:', err.message);
    res.status(500).send('Failed to issue authentication token.');
  }
}

// ── Auth Code (OTP) endpoints ─────────────────────────────────────────────────

// 3 code requests per 5 minutes per IP — prevents email flooding
const codeLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many code requests. Please wait before requesting another.' }
});

/**
 * Middleware: verify the shared PLUGIN_SECRET header.
 * Only the WordPress plugin (which stores this secret) can call these endpoints.
 */
function requirePluginSecret(req, res, next) {
  const provided = req.headers['x-plugin-secret'] || '';
  const expected = process.env.PLUGIN_SECRET || '';

  if (!expected) {
    return res.status(500).json({ error: 'PLUGIN_SECRET is not configured on the server.' });
  }

  let valid = false;
  try {
    const a = Buffer.from(provided.padEnd(expected.length));
    const b = Buffer.from(expected);
    valid = provided.length === expected.length && crypto.timingSafeEqual(a, b);
  } catch { valid = false; }

  if (!valid) return res.status(401).json({ error: 'Unauthorized.' });
  next();
}

/**
 * POST /auth/code/request
 * Called by the WP plugin. Generates a 6-digit OTP, emails it to the
 * configured notification email, and returns a signed OTP session token.
 *
 * The OTP session token is a HS256 JWT containing a hashed version of the
 * code — fully stateless, no server-side storage required.
 */
router.post('/code/request', codeLimiter, requirePluginSecret, async (req, res) => {
  const notificationEmail = loadNotificationEmail();
  if (!notificationEmail) {
    return res.status(500).json({ error: 'Notification email is not configured. Set it via /admin/notification-email.' });
  }

  const appUrl = process.env.APP_URL;
  const otpSecret = process.env.OTP_SECRET;
  if (!appUrl || !otpSecret) {
    return res.status(500).json({ error: 'APP_URL or OTP_SECRET not configured.' });
  }

  // Generate a cryptographically secure 6-digit code
  const code = String(crypto.randomInt(100000, 999999));
  const salt = crypto.randomBytes(16).toString('hex');
  const codeHash = crypto.createHmac('sha256', salt).update(code).digest('hex');

  // Build a stateless OTP session token — the code hash lives inside the JWT,
  // no database or cache needed (works perfectly on Vercel serverless)
  const otpToken = jwt.sign(
    {
      codeHash,
      salt,
      email: notificationEmail,
      iss: appUrl,
      aud: 'otp-session'
    },
    otpSecret,
    { algorithm: 'HS256', expiresIn: '10m' }
  );

  try {
    await sendOtpEmail(notificationEmail, code);
  } catch (err) {
    console.error('Failed to send OTP email:', err.message);
    return res.status(500).json({ error: 'Failed to send authentication code. Check SMTP settings.' });
  }

  res.json({ otp_token: otpToken, expires_in: 600 });
});

/**
 * POST /auth/code/verify
 * Called by the WP plugin with the otp_token + the code the user typed.
 * Verifies the code, then issues a standard RS256 login JWT for WordPress.
 */
router.post('/code/verify', codeLimiter, requirePluginSecret, express.json(), (req, res) => {
  const { otp_token, code } = req.body;

  if (!otp_token || !code) {
    return res.status(400).json({ error: 'otp_token and code are required.' });
  }

  if (!/^\d{6}$/.test(String(code).trim())) {
    return res.status(400).json({ error: 'Code must be exactly 6 digits.' });
  }

  const otpSecret = process.env.OTP_SECRET;
  const appUrl    = process.env.APP_URL;

  // Verify the OTP session token
  let otpPayload;
  try {
    otpPayload = jwt.verify(otp_token, otpSecret, {
      algorithms: ['HS256'],
      audience:   'otp-session',
      issuer:     appUrl
    });
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired session. Please request a new code.' });
  }

  // Verify the code using timing-safe comparison
  const providedHash = crypto.createHmac('sha256', otpPayload.salt)
    .update(String(code).trim())
    .digest('hex');

  let codeMatches = false;
  try {
    codeMatches = crypto.timingSafeEqual(
      Buffer.from(providedHash),
      Buffer.from(otpPayload.codeHash)
    );
  } catch { codeMatches = false; }

  if (!codeMatches) {
    return res.status(403).json({ error: 'Incorrect code.' });
  }

  // Code is valid — issue the standard RS256 login JWT for WordPress
  try {
    const privateKey = loadPrivateKey();
    const loginToken = jwt.sign(
      {
        email: otpPayload.email,
        name:  'Admin',
        iss:   appUrl,
        aud:   'wordpress-sso'
      },
      privateKey,
      {
        algorithm: 'RS256',
        expiresIn: '5m',
        jwtid: crypto.randomBytes(16).toString('hex')
      }
    );

    res.json({ login_token: loginToken });
  } catch (err) {
    console.error('JWT signing error:', err.message);
    res.status(500).json({ error: 'Failed to issue login token.' });
  }
});

// ── Risk Assessment ───────────────────────────────────────────────────────────

// 30 assess requests per 10 min per IP
const assessLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests.' }
});

/**
 * POST /auth/assess
 * Called by the WP plugin to score a login attempt.
 *
 * Body (JSON):
 *   ip               - client IP address collected by the plugin
 *   fingerprint_hash - SHA-256 hash of browser fingerprint components
 *   db_user_email    - email of user matched by IP+fingerprint in the WP DB (or null)
 *   cookie_user_email - email from a valid cad_dev_session cookie (or null)
 *
 * Returns:
 *   { decision: 'TRUSTED', login_token: '...' }
 *   { decision: 'UNCERTAIN' }
 *   { decision: 'BLOCKED' }
 */
router.post('/assess', assessLimiter, requirePluginSecret, async (req, res) => {
  const { ip, fingerprint_hash, db_user_email, cookie_user_email } = req.body;

  if (!ip || !fingerprint_hash) {
    return res.status(400).json({ error: 'ip and fingerprint_hash are required.' });
  }

  // Step 1: Hard block — IP on blacklist
  if (isBlacklisted(ip)) {
    return res.json({ decision: 'BLOCKED' });
  }

  // Step 2: Resolve which user we can identify.
  //
  // Conflict detection: if both signals are present but point to different people
  // (e.g. two developers sharing the same machine/browser), neither is reliable
  // enough to auto-login. Fall through to UNCERTAIN so Layer 2 identifies them.
  if (db_user_email && cookie_user_email &&
      db_user_email.toLowerCase() !== cookie_user_email.toLowerCase()) {
    return res.json({ decision: 'UNCERTAIN' });
  }

  // db_user_email is the primary signal (exact IP+fingerprint match in WP DB).
  // cookie_user_email is secondary (HMAC-verified session cookie).
  const user_email = db_user_email || cookie_user_email;

  // Step 3: No known user — cannot auto-login
  if (!user_email) {
    return res.json({ decision: 'UNCERTAIN' });
  }

  // Step 4: Revocation check — email must still be on the allowed list
  if (!isEmailAllowed(user_email)) {
    return res.json({ decision: 'BLOCKED' });
  }

  // Step 5: TRUSTED if the IP is whitelisted OR we have an exact DB match
  // - Whitelist + any known user (cookie or DB match) = TRUSTED
  // - Exact DB match (IP+fingerprint) = TRUSTED regardless of whitelist
  const trusted = isWhitelisted(ip) || !!db_user_email;

  if (!trusted) {
    return res.json({ decision: 'UNCERTAIN' });
  }

  // Issue the standard RS256 login JWT — same format as the Google SSO / auth code flows
  try {
    const privateKey = loadPrivateKey();
    const appUrl     = process.env.APP_URL;
    if (!appUrl) throw new Error('APP_URL is not set');

    const login_token = jwt.sign(
      {
        email: user_email,
        name:  '',              // no display name available in Layer 1
        iss:   appUrl,
        aud:   'wordpress-sso',
      },
      privateKey,
      {
        algorithm: 'RS256',
        expiresIn: '5m',
        jwtid: crypto.randomBytes(16).toString('hex'),
      }
    );

    return res.json({ decision: 'TRUSTED', login_token });
  } catch (err) {
    console.error('Assess JWT signing error:', err.message);
    // Fail open — show the login form rather than blocking
    return res.json({ decision: 'UNCERTAIN' });
  }
});

// ── Site Registration & Health Ping ──────────────────────────────────────────

/**
 * POST /auth/sites/register
 * Called by the WP plugin on activation and after the first owner login.
 * Upserts the site record so we have a central list of all installed sites.
 */
router.post('/sites/register', requirePluginSecret, (req, res) => {
  const { site_id, domain, owner_email, plugin_version } = req.body;

  if (!site_id || typeof site_id !== 'string' || site_id.length > 64) {
    return res.status(400).json({ error: 'Valid site_id required.' });
  }
  if (!domain || typeof domain !== 'string') {
    return res.status(400).json({ error: 'domain required.' });
  }

  try {
    new URL(domain); // validate it's a real URL
  } catch {
    return res.status(400).json({ error: 'Invalid domain URL.' });
  }

  if (owner_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(owner_email)) {
    return res.status(400).json({ error: 'Invalid owner_email.' });
  }

  registerSite({
    site_id,
    domain,
    owner_email: owner_email || null,
    plugin_version: plugin_version || 'unknown',
  });

  res.json({ success: true });
});

/**
 * POST /auth/sites/ping
 * Called by the WP plugin monthly (WP-Cron) to confirm the domain is still active.
 */
router.post('/sites/ping', requirePluginSecret, (req, res) => {
  const { site_id, domain } = req.body;

  if (!site_id || typeof site_id !== 'string') {
    return res.status(400).json({ error: 'site_id required.' });
  }

  const site = updateSitePing(site_id, domain || null);

  if (!site) {
    // Site wasn't registered yet — register it now
    if (domain) {
      registerSite({ site_id, domain, plugin_version: 'unknown' });
    }
  }

  res.json({ success: true });
});

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

module.exports = router;
