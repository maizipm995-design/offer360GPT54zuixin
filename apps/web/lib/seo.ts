import type { Metadata } from 'next';
import type { ServiceItem } from '@/types';

const DEFAULT_SITE_URL = 'https://www.offer360.cn';
const DEFAULT_SITE_NAME = 'Offer360';
const DEFAULT_SITE_TITLE = 'Offer360 - 中国校招招聘信息汇总平台与大学生求职平台';
const DEFAULT_SITE_DESCRIPTION =
  'Offer360 致力于打造中国校招招聘信息汇总平台中的权威入口，覆盖校招招聘信息、实习岗位、简历AI优化、面试辅导、笔试真题、面试逐字稿与求职全流程服务。';
const DEFAULT_SITE_KEYWORDS = [
  'offer360',
  '中国校招招聘信息汇总平台',
  '校招信息汇总',
  '大学生求职',
  '应届生招聘',
  '实习岗位',
  '春招秋招',
  '简历AI优化',
  '面试辅导',
  '笔试真题',
  '面试逐字稿',
];
const DEFAULT_SITE_TOPICS = [
  '校招招聘信息',
  '实习招聘',
  '简历AI优化',
  '面试辅导',
  '笔试真题',
  '面试逐字稿',
  '求职全流程服务',
];
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

function isLoopbackOrPrivateHostname(hostname: string) {
  const normalized = hostname.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  return (
    normalized === 'localhost'
    || normalized === '0.0.0.0'
    || normalized === '127.0.0.1'
    || normalized === '::1'
    || normalized === 'host.docker.internal'
    || /^127\./.test(normalized)
    || /^10\./.test(normalized)
    || /^192\.168\./.test(normalized)
    || /^172\.(1[6-9]|2\d|3[01])\./.test(normalized)
  );
}

function resolvePublicBaseUrl(input?: string | null) {
  const value = normalizeBaseUrl(input);
  if (!value) {
    return '';
  }

  try {
    const parsed = new URL(value);
    if (process.env.NODE_ENV === 'production') {
      if (parsed.protocol !== 'https:' || isLoopbackOrPrivateHostname(parsed.hostname)) {
        return '';
      }
    }

    const normalizedPath = parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/+$/, '');
    return `${parsed.origin}${normalizedPath}`;
  } catch {
    return '';
  }
}

export function getSiteUrl() {
  const siteUrl = resolvePublicBaseUrl(process.env.WEB_APP_BASE_URL);
  if (siteUrl) {
    return siteUrl;
  }

  const apiBaseUrl = resolvePublicBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL);
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
  seoContent,
}: {
  title: string;
  description: string;
  path?: string;
  keywords?: string[];
  robots?: Metadata['robots'];
  image?: string;
  seoContent?: string | string[];
}): Metadata {
  const url = getAbsoluteUrl(path);
  const ogImage = image || getDefaultOgImage();
  const normalizedSeoContent = Array.isArray(seoContent)
    ? seoContent.filter(Boolean)
    : seoContent
      ? [seoContent]
      : [];

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
    other: normalizedSeoContent.length > 0
      ? {
          'seo-content': normalizedSeoContent,
        }
      : undefined,
  };
}

export function buildRootMetadata(): Metadata {
  return {
    metadataBase: new URL(getSiteUrl()),
    manifest: '/manifest.webmanifest',
    title: {
      default: DEFAULT_SITE_TITLE,
      template: '%s - Offer360',
    },
    description: DEFAULT_SITE_DESCRIPTION,
    keywords: DEFAULT_SITE_KEYWORDS,
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
      title: DEFAULT_SITE_TITLE,
      description: DEFAULT_SITE_DESCRIPTION,
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
      title: DEFAULT_SITE_TITLE,
      description: DEFAULT_SITE_DESCRIPTION,
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
    description: DEFAULT_SITE_DESCRIPTION,
    areaServed: 'CN',
    slogan: '校招招聘信息汇总与大学生求职全流程服务平台',
    knowsAbout: DEFAULT_SITE_TOPICS,
  };
}

export function buildWebsiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: DEFAULT_SITE_NAME,
    url: getAbsoluteUrl('/'),
    inLanguage: 'zh-CN',
    description: DEFAULT_SITE_DESCRIPTION,
    publisher: {
      '@type': 'Organization',
      name: DEFAULT_SITE_NAME,
      url: getAbsoluteUrl('/'),
    },
    about: DEFAULT_SITE_TOPICS,
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

export function buildWebPageSchema({
  title,
  description,
  path,
  type = 'WebPage',
}: {
  title: string;
  description: string;
  path: string;
  type?: 'WebPage' | 'CollectionPage' | 'AboutPage';
}) {
  return {
    '@context': 'https://schema.org',
    '@type': type,
    name: title,
    description,
    url: getAbsoluteUrl(path),
    inLanguage: 'zh-CN',
    isPartOf: {
      '@type': 'WebSite',
      name: DEFAULT_SITE_NAME,
      url: getAbsoluteUrl('/'),
    },
    about: DEFAULT_SITE_TOPICS,
  };
}

export function buildServiceListSchema(services: ServiceItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Offer360 求职服务列表',
    itemListOrder: 'https://schema.org/ItemListOrderAscending',
    numberOfItems: services.length,
    itemListElement: services.map((service, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: getAbsoluteUrl(`/services/${encodeURIComponent(service.id)}`),
      name: service.name,
      description: service.description,
    })),
  };
}

export function buildServiceSchema(service: ServiceItem) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: service.name,
    description: service.description,
    areaServed: 'CN',
    serviceType: '大学生求职服务',
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
