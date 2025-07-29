/** @type {import('next').NextConfig} */
const nextConfig = {
  // Production-optimized configuration
  experimental: {
    // Enable for better server-side performance
    serverComponentsExternalPackages: ['@supabase/supabase-js']
  },

  // Production optimizations
  compress: process.env.NODE_ENV === 'production',
  poweredByHeader: false,
  
  // Headers for both development and production
  async headers() {
    return [
      {
        // API routes - no caching for dynamic content
        source: '/api/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate',
          },
          {
            key: 'Access-Control-Allow-Origin',
            value: process.env.NODE_ENV === 'development' ? '*' : 'https://voice-memory-tau.vercel.app',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'X-Requested-With, Content-Type, Authorization',
          },
        ],
      },
    ]
  },

  // Production redirects
  async redirects() {
    return [
      {
        source: '/dashboard',
        destination: '/',
        permanent: true,
      },
    ]
  },

  // Environment-specific optimizations
  swcMinify: process.env.NODE_ENV === 'production',
  eslint: {
    ignoreDuringBuilds: process.env.NODE_ENV === 'development',
  },
  typescript: {
    ignoreBuildErrors: process.env.NODE_ENV === 'development',
  },

  // Output configuration for Vercel
  output: 'standalone',
}

module.exports = nextConfig