import type { MetadataRoute } from 'next'

/**
 * robots.txt for the public deployment. The app itself is a single-route SPA;
 * view anchors (#play, #puzzles, …) are client-side and not crawlable URLs,
 * so only the canonical root is exposed.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/'],
    },
    sitemap: 'https://knightforge-web.onrender.com/sitemap.xml',
  }
}
