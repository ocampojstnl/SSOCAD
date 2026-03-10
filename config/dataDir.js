const path = require('path');

/**
 * Vercel's serverless filesystem is read-only except for /tmp.
 * In production (Vercel), store mutable data under /tmp.
 * In development, keep it next to the project root for easy inspection.
 *
 * NOTE: /tmp on Vercel is per-instance and ephemeral — data is lost on cold
 * starts. Critical config (allowed emails, notification email, IP lists) is
 * seeded from environment variables each time, so cold starts are safe.
 */
const DATA_DIR = process.env.VERCEL
  ? '/tmp/cad-dev-sso-data'
  : path.join(__dirname, '..', 'data');

module.exports = DATA_DIR;
