'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, Eye, EyeOff, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function LoginPage() {
  const [secret, setSecret] = useState('')
  const [show, setShow] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const res = await fetch('/api/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ secret }),
      })
      if (res.ok) {
        router.push('/dashboard')
      } else {
        toast.error('Invalid admin secret.')
      }
    })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-800 ring-1 ring-zinc-700">
            <Lock className="h-7 w-7 text-sky-400" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Cad Dev SSO</h1>
          <p className="mt-1 text-sm text-muted-foreground">Admin Dashboard</p>
        </div>

        <Card className="border-zinc-800 bg-zinc-900">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Sign in</CardTitle>
            <CardDescription>Enter your admin secret to continue.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="secret">Admin Secret</Label>
                <div className="relative">
                  <Input
                    id="secret"
                    type={show ? 'text' : 'password'}
                    value={secret}
                    onChange={e => setSecret(e.target.value)}
                    placeholder="Enter ADMIN_SECRET"
                    autoComplete="current-password"
                    className="pr-10 bg-zinc-800 border-zinc-700"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShow(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={isPending || !secret}>
                {isPending
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Signing in…</>
                  : 'Sign In'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
