'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Plus, Loader2, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

export function EmailList({ initialEmails }: { initialEmails: string[] }) {
  const [email, setEmail] = useState('')
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const res = await fetch('/api/admin/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (res.ok) {
        setEmail('')
        toast.success('Email added')
        router.refresh()
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error ?? 'Failed to add email')
      }
    })
  }

  function handleRemove(target: string) {
    startTransition(async () => {
      const res = await fetch(`/api/admin/emails/${encodeURIComponent(target)}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        toast.success('Email removed')
        router.refresh()
      } else {
        toast.error('Failed to remove email')
      }
    })
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleAdd} className="flex gap-2">
        <Input
          type="email"
          placeholder="developer@example.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="bg-zinc-800 border-zinc-700"
          required
        />
        <Button type="submit" disabled={isPending || !email}>
          {isPending
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <Plus className="h-4 w-4" />}
          Add
        </Button>
      </form>

      <div className="space-y-1.5">
        {initialEmails.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">No emails added yet.</p>
        ) : (
          initialEmails.map(e => (
            <div
              key={e}
              className="flex items-center justify-between rounded-md border border-zinc-800 bg-zinc-800/40 px-4 py-2"
            >
              <div className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                <span className="font-mono text-sm">{e}</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                disabled={isPending}
                onClick={() => handleRemove(e)}
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
