import { getBugReports } from '@/lib/storage'
import { BugsBoard } from '@/components/dashboard/bugs-board'

export const dynamic = 'force-dynamic'

export default async function BugsPage() {
  const reports = await getBugReports()
  return <BugsBoard initialReports={reports} />
}
