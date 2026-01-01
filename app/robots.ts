import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: '/admin-dashboard/',
    },
    sitemap: 'https://voice-memory.vercel.app/sitemap.xml',
  }
}