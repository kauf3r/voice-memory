/** @type {import('next').NextConfig} */
const nextConfig = {
  // Minimal config for fast development startup
  experimental: {
    // Disable experimental features for faster startup
  },

  // Essential optimizations only
  compress: false, // Disable in dev for speed
  poweredByHeader: false,
  
  // Minimal headers for development
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
        ],
      },
    ]
  },

  // Skip redirects in development
  async redirects() {
    return []
  },

  // Development-specific optimizations
  swcMinify: false, // Disable minification in dev
  eslint: {
    ignoreDuringBuilds: true, // Skip ESLint during dev builds
  },
  typescript: {
    ignoreBuildErrors: true, // Skip TypeScript checks during dev builds
  },
}

module.exports = nextConfig