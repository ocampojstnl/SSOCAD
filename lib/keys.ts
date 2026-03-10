import crypto from 'crypto'

export function loadPrivateKey() {
  const raw = process.env.RSA_PRIVATE_KEY
  if (!raw) throw new Error('RSA_PRIVATE_KEY environment variable is not set')
  const base64 = raw
    .replace(/-----[^-]+-----/g, '')
    .replace(/[^A-Za-z0-9+/=]/g, '')
  if (!base64) throw new Error('RSA_PRIVATE_KEY is empty after stripping PEM headers')
  const lines = (base64.match(/.{1,64}/g) ?? []).join('\n')
  const pem = `-----BEGIN PRIVATE KEY-----\n${lines}\n-----END PRIVATE KEY-----\n`
  return crypto.createPrivateKey({ key: pem, format: 'pem' })
}

export function loadPublicKey(): string {
  const raw = process.env.RSA_PUBLIC_KEY
  if (raw) {
    // Reconstruct clean PEM from env var (handles \n escaping, missing line breaks, etc.)
    const base64 = raw
      .replace(/-----[^-]+-----/g, '')
      .replace(/[^A-Za-z0-9+/=]/g, '')
    if (base64) {
      const lines = (base64.match(/.{1,64}/g) ?? []).join('\n')
      return `-----BEGIN PUBLIC KEY-----\n${lines}\n-----END PUBLIC KEY-----\n`
    }
  }
  throw new Error('RSA_PUBLIC_KEY environment variable is not set')
}
