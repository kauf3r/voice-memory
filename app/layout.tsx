import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AuthProvider } from './components/AuthProvider'
import ErrorBoundary from './components/ErrorBoundary'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
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
    apple: '/apple-icon.png',
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
      <body className={inter.className}>
        <ErrorBoundary>
          <AuthProvider>{children}</AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  )
}