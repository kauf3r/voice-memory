import AnalysisDashboard from '@/app/components/AnalysisDashboard'

export default function AnalysisDashboardPage() {
  return (
    <div className="min-h-screen bg-background">
      <AnalysisDashboard />
    </div>
  )
}

export const metadata = {
  title: 'Analysis Dashboard - Voice Memory',
  description: 'Monitor AI analysis performance, costs, and system health',
}