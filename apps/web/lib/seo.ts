import type { Metadata } from 'next';
import type { ServiceItem } from '@/types';

const DEFAULT_SITE_URL = 'https://www.offer360.cn';
const DEFAULT_SITE_NAME = 'Offer360';
const FAVICON_URL = 'https://i.postimg.cc/h4scGvF6/sun-lao-shilogo-64X64.png';
const SEARCH_LOGO_URL = 'https://i.postimg.cc/J05Dn45v/sun-lao-shilogo-192X192.png';
const DEFAULT_OG_IMAGE = FAVICON_URL;
const BAIDU_VERIFICATION_CODE = 'codeva-m269Vh4kNt';

function normalizeBaseUrl(input?: string | null) {
  const value = (input || '').trim();
  if (!value) {
    return '';
  }
  return value.replace(/\/+$/, '');
}

export function getSiteUrl() {
  const siteUrl = normalizeBaseUrl(process.env.WEB_APP_BASE_URL);
  if (siteUrl) {
    return siteUrl;
  }

  const apiBaseUrl = normalizeBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL);
  if (apiBaseUrl) {
    return apiBaseUrl.replace(/\/api$/i, '');
  }

  return DEFAULT_SITE_URL;
}

export function getAbsoluteUrl(path = '/') {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getSiteUrl()}${normalizedPath === '/' ? '' : normalizedPath}`;
}

export function getDefaultOgImage() {
  return DEFAULT_OG_IMAGE;
}

export function buildPageMetadata({
  title,
  description,
  path = '/',
  keywords,
  robots,
  image,
}: {
  title: string;
  description: string;
  path?: string;
  keywords?: string[];
  robots?: Metadata['robots'];
  image?: string;
}): Metadata {
  const url = getAbsoluteUrl(path);
  const ogImage = image || getDefaultOgImage();

  return {
    title,
    description,
    keywords,
    alternates: {
      canonical: path,
    },
    robots,
    openGraph: {
      title,
      description,
      url,
      siteName: DEFAULT_SITE_NAME,
      locale: 'zh_CN',
      type: 'website',
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: `${DEFAULT_SITE_NAME} 分享封面`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
  };
}

export function buildRootMetadata(): Metadata {
  return {
    metadataBase: new URL(getSiteUrl()),
    manifest: '/manifest.webmanifest',
    title: {
      default: 'Offer360 - 2026-2027届校招信息汇总与大学生求职平台',
      template: '%s - Offer360',
    },
    description: 'Offer360 专注大学生应届生求职，实时汇总校招、春招、秋招、实习、内推网申信息。',
    keywords: ['offer360', '校招信息汇总', '大学生求职', '应届生招聘', '实习岗位', '春招秋招', '内推网申'],
    authors: [{ name: DEFAULT_SITE_NAME }],
    creator: DEFAULT_SITE_NAME,
    publisher: DEFAULT_SITE_NAME,
    applicationName: DEFAULT_SITE_NAME,
    category: 'job search',
    icons: {
      icon: [
        { url: FAVICON_URL, type: 'image/png', sizes: '64x64' },
        { url: SEARCH_LOGO_URL, type: 'image/png', sizes: '192x192' },
      ],
      shortcut: [FAVICON_URL],
      apple: [{ url: SEARCH_LOGO_URL, sizes: '192x192', type: 'image/png' }],
    },
    verification: {
      other: {
        'baidu-site-verification': BAIDU_VERIFICATION_CODE,
      },
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
      },
    },
    openGraph: {
      title: 'Offer360 - 2026-2027届校招信息汇总与大学生求职平台',
      description: 'Offer360 专注大学生应届生求职，实时汇总校招、春招、秋招、实习、内推网申信息。',
      url: getAbsoluteUrl('/'),
      siteName: DEFAULT_SITE_NAME,
      locale: 'zh_CN',
      type: 'website',
      images: [
        {
          url: getDefaultOgImage(),
          width: 1200,
          height: 630,
          alt: `${DEFAULT_SITE_NAME} 分享封面`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Offer360 - 2026-2027届校招信息汇总与大学生求职平台',
      description: 'Offer360 专注大学生应届生求职，实时汇总校招、春招、秋招、实习、内推网申信息。',
      images: [getDefaultOgImage()],
    },
  };
}

export function buildOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: DEFAULT_SITE_NAME,
    url: getAbsoluteUrl('/'),
    logo: SEARCH_LOGO_URL,
  };
}

export function buildWebsiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: DEFAULT_SITE_NAME,
    url: getAbsoluteUrl('/'),
    inLanguage: 'zh-CN',
  };
}

export function buildBreadcrumbSchema(items: Array<{ name: string; path: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: getAbsoluteUrl(item.path),
    })),
  };
}

export function buildServiceSchema(service: ServiceItem) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: service.name,
    description: service.description,
    provider: {
      '@type': 'Organization',
      name: DEFAULT_SITE_NAME,
      url: getAbsoluteUrl('/'),
    },
    offers: {
      '@type': 'Offer',
      priceCurrency: 'CNY',
      price: String(service.price),
      availability: 'https://schema.org/InStock',
      url: getAbsoluteUrl(`/services/${encodeURIComponent(service.id)}`),
    },
  };
}
