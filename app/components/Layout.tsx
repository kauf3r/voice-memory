import Header from './Header'

interface LayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}

// Grid components for consistent layouts
export function GridContainer({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 ${className}`}>
      {children}
    </div>
  )
}

export function GridItem({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 ${className}`}>
      {children}
    </div>
  )
}

export function TwoColumnLayout({ 
  sidebar, 
  main,
  sidebarWidth = 'w-64'
}: { 
  sidebar: React.ReactNode; 
  main: React.ReactNode;
  sidebarWidth?: string;
}) {
  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <aside className={`lg:${sidebarWidth} lg:flex-shrink-0`}>
        {sidebar}
      </aside>
      <div className="flex-1 min-w-0">
        {main}
      </div>
    </div>
  )
}