'use client'
import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface CopyFieldProps {
  value: string
  mono?: boolean
  rows?: number
}

export function CopyField({ value, mono = true, rows = 1 }: CopyFieldProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative">
      {rows > 1 ? (
        <textarea
          readOnly
          value={value}
          rows={rows}
          className={`w-full resize-none rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 pr-10 text-sm text-foreground focus:outline-none ${mono ? 'font-mono text-xs' : ''}`}
        />
      ) : (
        <input
          readOnly
          value={value}
          className={`w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 pr-10 text-sm text-foreground focus:outline-none ${mono ? 'font-mono text-xs' : ''}`}
        />
      )}
      <Button
        size="icon"
        variant="ghost"
        onClick={handleCopy}
        className="absolute right-1 top-1 h-7 w-7 text-muted-foreground hover:text-foreground"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
    </div>
  )
}
