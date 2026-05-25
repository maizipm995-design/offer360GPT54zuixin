import type { Metadata } from 'next';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import { ServiceDetailPageClient } from '@/components/services/service-detail-page-client';
import { serverGet } from '@/lib/api';
import { buildBreadcrumbSchema, buildPageMetadata, buildServiceSchema, buildWebPageSchema } from '@/lib/seo';
import type { ServiceItem } from '@/types';

export const revalidate = 300;

const serviceDetailRequestInit = {
  next: {
    revalidate,
  },
} satisfies RequestInit;

interface ServiceDetailPageProps {
  params: { id: string };
}

const getService = cache(async (serviceId: string) => {
  try {
    return await serverGet<ServiceItem>(`/service-products/${encodeURIComponent(serviceId)}`, serviceDetailRequestInit);
  } catch {
    return null;
  }
});

export async function generateMetadata({ params }: ServiceDetailPageProps): Promise<Metadata> {
  const serviceId = decodeRouteParam(params.id);
  const service = await getService(serviceId);

  if (!service) {
    return buildPageMetadata({
      title: '服务详情',
      description: 'offer360 求职服务详情页。',
      path: `/services/${encodeURIComponent(serviceId)}`,
      robots: {
        index: false,
        follow: false,
      },
    });
  }

  return buildPageMetadata({
    title: `${service.name}_求职服务详情`,
    description: service.description || `${service.name} - offer360 求职服务详情页`,
    path: `/services/${encodeURIComponent(service.id)}`,
    keywords: [service.name, '求职服务', '简历优化', '面试辅导', 'offer360'],
  });
}

export default async function ServiceDetailPage({ params }: ServiceDetailPageProps) {
  const serviceId = decodeRouteParam(params.id);
  const service = await getService(serviceId);

  if (!service) {
    notFound();
  }

  const servicePageSchema = buildWebPageSchema({
    title: `${service.name} - Offer360 求职服务详情`,
    description: service.description || `${service.name} - Offer360 求职服务详情页`,
    path: `/services/${encodeURIComponent(service.id)}`,
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(servicePageSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildServiceSchema(service)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            buildBreadcrumbSchema([
              { name: '首页', path: '/' },
              { name: '求职服务', path: '/services' },
              { name: service.name, path: `/services/${encodeURIComponent(service.id)}` },
            ]),
          ),
        }}
      />
      <ServiceDetailPageClient service={service} />
    </>
  );
}

function decodeRouteParam(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
