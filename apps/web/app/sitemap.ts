import type { MetadataRoute } from 'next';
import { serverGet } from '@/lib/api';
import { getAbsoluteUrl } from '@/lib/seo';
import type { ServiceItem } from '@/types';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: getAbsoluteUrl('/'),
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: getAbsoluteUrl('/services'),
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: getAbsoluteUrl('/membership'),
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: getAbsoluteUrl('/career-journey'),
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
  ];

  try {
    const services = await serverGet<ServiceItem[]>('/service-products');
    const serviceRoutes: MetadataRoute.Sitemap = services
      .filter((service) => service.id?.trim())
      .map((service) => ({
        url: getAbsoluteUrl(`/services/${encodeURIComponent(service.id)}`),
        lastModified: now,
        changeFrequency: 'weekly',
        priority: 0.75,
      }));

    return [...staticRoutes, ...serviceRoutes];
  } catch (error) {
    console.error('Failed to build dynamic service sitemap routes.', error);
    return staticRoutes;
  }
}
