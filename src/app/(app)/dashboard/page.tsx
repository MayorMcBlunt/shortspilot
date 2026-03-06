import DashboardClient from './DashboardClient'

export default function DashboardPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
      <DashboardClient />
    </div>
  )
}
