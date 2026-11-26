import type { MetadataRoute } from 'next'

/**
 * Minimal sitemap: KnightForge serves one canonical page (the SPA shell);
 * everything else is in-app hash navigation which search engines cannot
 * index as separate URLs.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://knightforge-web.onrender.com/',
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
  ]
}
