import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/services',
          '/services/',
          '/membership',
          '/career-journey',
          '/campus-exam',
          '/campus-exam/category/',
          '/campus-exam/special/',
          '/campus-exam/question/',
          '/resume-optimizer',
          '/interview-transcript',
        ],
        disallow: [
          '/admin/',
          '/api/',
          '/checkout',
          '/payments/',
          '/personal-center',
          '/invite/',
          '/login',
          '/register',
          '/campus-exam/history',
          '/campus-exam/practice',
          '/campus-exam/special/*/practice',
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
