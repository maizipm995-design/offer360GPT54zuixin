import type { Metadata } from 'next';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import { SeoLinkCluster } from '@/components/common/seo-link-cluster';
import { ServiceDetailPageClient } from '@/components/services/service-detail-page-client';
import { serverGet } from '@/lib/api';
import {
  buildBreadcrumbSchema,
  buildPageMetadata,
  buildServiceSchema,
  buildWebPageSchema,
  mergeSeoKeywords,
  SEO_OVERSEAS_JOB_KEYWORDS,
} from '@/lib/seo';
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
      description: 'Offer360 求职服务详情页。',
      path: `/services/${encodeURIComponent(serviceId)}`,
      robots: {
        index: false,
        follow: false,
      },
    });
  }

  const title = `${service.name}_实习校招求职全流程服务`;
  const description = service.description
    ? `${service.name}：${service.description}。Offer360 持续服务大学生、留学生与海归群体，覆盖实习校招、AI简历优化、面试辅导与求职全流程场景。`
    : `Offer360 为你提供专业的 ${service.name} 服务，助力大学生、留学生与海归高效完成实习校招准备、AI简历优化、面试辅导与求职全流程规划。`;

  return buildPageMetadata({
    title,
    description,
    path: `/services/${encodeURIComponent(service.id)}`,
    keywords: mergeSeoKeywords(
      [
        service.name,
        `${service.name}服务`,
        '求职服务',
        '实习校招',
        '招聘公告',
        '春招',
        '秋招',
        '夏招',
        'AI简历优化',
        '面试辅导',
        '校招笔试真题',
        '面试逐字稿',
        '求职全流程',
        '大学生',
        '留学生',
        '海归',
        'Offer360',
      ],
      SEO_OVERSEAS_JOB_KEYWORDS,
    ),
    seoContent: [
      `${service.name} 是 Offer360 求职服务体系的重要组成部分，服务于实习校招、春招、秋招与夏招等关键阶段。`,
      '页面围绕大学生、留学生与海归用户的求职全流程需求，连接招聘公告获取、AI简历优化、校招笔试真题训练、面试辅导与面试逐字稿复盘能力。',
    ],
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
      <div className="mx-auto max-w-[1366px]">
        <ServiceDetailPageClient service={service} />
        <section className="px-4 pb-12 lg:px-8">
          <SeoLinkCluster
            currentPath={`/services/${encodeURIComponent(service.id)}`}
            title="查看更多求职资源"
            description={`在了解 ${service.name} 之余，你还可以同步关注名企校招公告、练习笔试真题，或使用 AI 智能工具优化你的简历与面试表现。`}
          />
        </section>
      </div>
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
