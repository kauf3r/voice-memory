import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from './components/AuthProvider'
import ErrorBoundary from './components/ErrorBoundary'
import { ProcessingStatsProvider } from '@/lib/contexts/ProcessingStatsContext'
import { ToastProvider } from './components/ToastProvider'
import AuthDebugInfo from './components/AuthDebugInfo'
import BetaFeatures from './components/BetaFeatures'

// Use system fonts instead of Google Fonts to avoid build issues
const systemFonts = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  title: 'Voice Memory',
  description: 'Transform voice notes into actionable insights with AI',
  keywords: ['voice notes', 'AI analysis', 'productivity', 'transcription', 'insights'],
  authors: [{ name: 'Voice Memory' }],
  creator: 'Voice Memory',
  publisher: 'Voice Memory',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Voice Memory',
  },
  openGraph: {
    type: 'website',
    siteName: 'Voice Memory',
    title: 'Voice Memory - Transform Voice Notes into Insights',
    description: 'Transform voice notes into actionable insights with AI',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Voice Memory App',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Voice Memory - Transform Voice Notes into Insights',
    description: 'Transform voice notes into actionable insights with AI',
    images: ['/og-image.png'],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: systemFonts }} suppressHydrationWarning={true}>
        <ErrorBoundary>
          <AuthProvider>
            <ToastProvider>
              <ProcessingStatsProvider>
                {children}
                <AuthDebugInfo />
                <BetaFeatures />
              </ProcessingStatsProvider>
            </ToastProvider>
          </AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  )
}