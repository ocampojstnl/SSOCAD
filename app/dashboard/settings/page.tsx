import { Settings } from 'lucide-react'
import { SettingsForm } from '@/components/dashboard/settings-form'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { loadNotificationEmail } = require('../../../config/notificationEmail')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { loadPublicKey } = require('../../../config/keys')

function safeLoadPublicKey(): string {
  try { return loadPublicKey() } catch { return '' }
}

export default function SettingsPage() {
  const notificationEmail: string = loadNotificationEmail()
  const publicKey: string = safeLoadPublicKey()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure authentication and notification settings.
        </p>
      </div>
      <SettingsForm
        initialNotificationEmail={notificationEmail}
        publicKey={publicKey}
      />
    </div>
  )
}
