'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Plus, Loader2, Shield } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

function IpSection({
  list,
  type,
  isPending,
  onAdd,
  onRemove,
}: {
  list: string[]
  type: 'whitelist' | 'blacklist'
  isPending: boolean
  onAdd: (ip: string) => void
  onRemove: (ip: string) => void
}) {
  const [ip, setIp] = useState('')

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    onAdd(ip)
    setIp('')
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleAdd} className="flex gap-2">
        <Input
          placeholder="192.168.1.1 or 2001:db8::1"
          value={ip}
          onChange={e => setIp(e.target.value)}
          className="bg-zinc-800 border-zinc-700 font-mono text-sm"
          required
        />
        <Button type="submit" disabled={isPending || !ip}>
          {isPending
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <Plus className="h-4 w-4" />}
          Add
        </Button>
      </form>

      <div className="space-y-1.5">
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            No IPs in {type} yet.
          </p>
        ) : (
          list.map(addr => (
            <div
              key={addr}
              className="flex items-center justify-between rounded-md border border-zinc-800 bg-zinc-800/40 px-4 py-2"
            >
              <div className="flex items-center gap-2">
                <Shield
                  className={`h-3.5 w-3.5 flex-shrink-0 ${
                    type === 'whitelist' ? 'text-emerald-400' : 'text-red-400'
                  }`}
                />
                <span className="font-mono text-sm">{addr}</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                disabled={isPending}
                onClick={() => onRemove(addr)}
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

export function IpList({
  initialWhitelist,
  initialBlacklist,
}: {
  initialWhitelist: string[]
  initialBlacklist: string[]
}) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function mutate(url: string, method: string, body?: object) {
    startTransition(async () => {
      const res = await fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined,
      })
      if (res.ok) {
        router.refresh()
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error ?? 'Request failed')
      }
    })
  }

  return (
    <Tabs defaultValue="whitelist">
      <TabsList className="bg-zinc-800">
        <TabsTrigger value="whitelist">
          Whitelist ({initialWhitelist.length})
        </TabsTrigger>
        <TabsTrigger value="blacklist">
          Blacklist ({initialBlacklist.length})
        </TabsTrigger>
      </TabsList>

      <TabsContent value="whitelist" className="mt-4">
        <IpSection
          list={initialWhitelist}
          type="whitelist"
          isPending={isPending}
          onAdd={ip => mutate('/api/admin/ips/whitelist', 'POST', { ip })}
          onRemove={ip =>
            mutate(`/api/admin/ips/whitelist/${encodeURIComponent(ip)}`, 'DELETE')
          }
        />
      </TabsContent>

      <TabsContent value="blacklist" className="mt-4">
        <IpSection
          list={initialBlacklist}
          type="blacklist"
          isPending={isPending}
          onAdd={ip => mutate('/api/admin/ips/blacklist', 'POST', { ip })}
          onRemove={ip =>
            mutate(`/api/admin/ips/blacklist/${encodeURIComponent(ip)}`, 'DELETE')
          }
        />
      </TabsContent>
    </Tabs>
  )
}
