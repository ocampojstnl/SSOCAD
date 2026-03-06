import { Mail } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmailList } from '@/components/dashboard/email-list'
import { getEmails } from '@/lib/storage'

export default async function EmailsPage() {
  const emails = await getEmails()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Allowed Emails</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Developers on this list can authenticate via SSO.
        </p>
      </div>

      <Card className="border-zinc-800 bg-zinc-900">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Email Allowlist</CardTitle>
          </div>
          <CardDescription>
            {emails.length} authorized developer{emails.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmailList initialEmails={emails} />
        </CardContent>
      </Card>
    </div>
  )
}
