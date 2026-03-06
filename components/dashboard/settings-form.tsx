'use client'
import { useState, useTransition, useRef } from 'react'
import { Check, Copy, Loader2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { toast } from 'sonner'

export function SettingsForm({
  initialNotificationEmail,
  publicKey,
}: {
  initialNotificationEmail: string
  publicKey: string
}) {
  const [email, setEmail] = useState(initialNotificationEmail)
  const [isPending, startTransition] = useTransition()
  const [copied, setCopied] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [isUploading, startUpload] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const res = await fetch('/api/admin/notification-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (res.ok) {
        toast.success('Notification email updated')
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error ?? 'Failed to update')
      }
    })
  }

  function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!uploadFile) return
    startUpload(async () => {
      const form = new FormData()
      form.append('plugin', uploadFile)
      const res = await fetch('/api/admin/plugin/upload', { method: 'POST', body: form })
      if (res.ok) {
        toast.success('Plugin zip updated')
        setUploadFile(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error ?? 'Upload failed')
      }
    })
  }

  function copyPublicKey() {
    navigator.clipboard.writeText(publicKey)
    setCopied(true)
    toast.success('Public key copied')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6">
      <Card className="border-zinc-800 bg-zinc-900">
        <CardHeader>
          <CardTitle className="text-base">Auth Code Email</CardTitle>
          <CardDescription>
            OTP codes are sent to this address when a developer uses the auth code flow.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="notif-email">Notification Email</Label>
              <div className="flex gap-2">
                <Input
                  id="notif-email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="bg-zinc-800 border-zinc-700"
                  required
                />
                <Button type="submit" disabled={isPending}>
                  {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border-zinc-800 bg-zinc-900">
        <CardHeader>
          <CardTitle className="text-base">Plugin ZIP</CardTitle>
          <CardDescription>
            Upload a new plugin zip to replace the current downloadable on the Plugin &amp; Keys page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpload} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="plugin-zip">Select .zip file</Label>
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  id="plugin-zip"
                  type="file"
                  accept=".zip"
                  onChange={e => setUploadFile(e.target.files?.[0] ?? null)}
                  className="flex-1 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-foreground file:mr-3 file:rounded file:border-0 file:bg-zinc-700 file:px-2 file:py-1 file:text-xs file:text-foreground"
                />
                <Button type="submit" disabled={!uploadFile || isUploading}>
                  {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Upload
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border-zinc-800 bg-zinc-900">
        <CardHeader>
          <CardTitle className="text-base">RSA Public Key</CardTitle>
          <CardDescription>
            Paste this into your WordPress plugin settings. Used to verify login tokens locally.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <pre className="overflow-x-auto rounded-md border border-zinc-700 bg-zinc-800 p-3 text-xs font-mono leading-relaxed whitespace-pre-wrap">
            {publicKey || 'Key not found. Run: npm run generate-keys'}
          </pre>
          <Button
            variant="outline"
            size="sm"
            className="border-zinc-700"
            onClick={copyPublicKey}
            disabled={!publicKey}
          >
            {copied ? (
              <Check className="h-4 w-4 text-emerald-400" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            {copied ? 'Copied!' : 'Copy Key'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
