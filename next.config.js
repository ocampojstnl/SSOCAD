/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep the same URL paths the WP plugin already knows about.
  // /auth/* and /admin/* rewrite to the Next.js API routes transparently.
  async rewrites() {
    return [
      { source: '/auth/:path*', destination: '/api/auth/:path*' },
      { source: '/admin/:path*', destination: '/api/admin/:path*' },
    ]
  },
  // nodemailer and google-auth-library use Node.js built-ins —
  // keep them server-side only.
  serverExternalPackages: ['nodemailer', 'google-auth-library'],
  outputFileTracingIncludes: {
    '/**': ['./keys/**', './data/**', './config/**'],
  },
}

module.exports = nextConfig
