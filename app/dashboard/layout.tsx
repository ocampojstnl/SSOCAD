import { Sidebar } from '@/components/dashboard/sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  )
}
