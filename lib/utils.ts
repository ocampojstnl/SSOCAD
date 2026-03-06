import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

export function timingSafeCompare(a: string, b: string): boolean {
  const { timingSafeEqual } = require('crypto') as typeof import('crypto')
  try {
    const bufA = Buffer.from(a.padEnd(b.length))
    const bufB = Buffer.from(b)
    return a.length === b.length && timingSafeEqual(bufA, bufB)
  } catch {
    return false
  }
}
