import type { SessionOptions } from 'iron-session'

export interface SessionData {
  isAdmin?:      boolean
  oauthNonce?:   string
  wpRedirectUri?: string
  wpState?:      string
  googleUser?: {
    email:   string
    name:    string
    picture: string
  }
}

// SESSION_SECRET must be at least 32 characters.
// iron-session uses AES-256-GCM — shorter passwords will throw at runtime.
export const sessionOptions: SessionOptions = {
  password:   process.env.SESSION_SECRET as string,
  cookieName: 'cad_dev_sid',
  cookieOptions: {
    secure:   process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge:   60 * 60 * 24, // 24 h
  },
}
