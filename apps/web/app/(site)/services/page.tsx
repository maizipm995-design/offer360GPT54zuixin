import type { Metadata } from 'next';
import { unstable_cache } from 'next/cache';
import { SeoHiddenContent } from '@/components/common/seo-hidden-content';
import { SeoLinkCluster } from '@/components/common/seo-link-cluster';
import { ServiceGrid } from '@/components/services/service-grid';
import { serverGet } from '@/lib/api';
import {
  buildBreadcrumbSchema,
  buildPageMetadata,
  buildServiceListSchema,
  buildWebPageSchema,
  mergeSeoKeywords,
  SEO_COMPETITOR_BRANDS,
  SEO_OVERSEAS_JOB_KEYWORDS,
} from '@/lib/seo';
import { ServiceItem } from '@/types';

export const dynamic = 'force-dynamic';
export const revalidate = 300;

const getServicesPageData = unstable_cache(
  async () => serverGet<ServiceItem[]>('/service-products'),
  ['site-services-page'],
  { revalidate },
);

export const metadata: Metadata = buildPageMetadata({
  title: '求职服务_AI简历优化_面试辅导_笔试真题练习_一站式求职陪跑',
  description:
    'Offer360 为大学生、留学生与海归提供一站式求职全流程服务，覆盖实习校招、招聘公告、春招、秋招、夏招，以及 AI 简历优化、面试辅导、校招笔试真题、面试逐字稿和专业求职陪跑。',
  path: '/services',
  keywords: mergeSeoKeywords([
    '求职服务',
    '实习校招',
    '招聘公告',
    '春招',
    '秋招',
    '夏招',
    'AI简历优化',
    '简历精修',
    '面试辅导',
    '面试复盘',
    '校招笔试真题',
    '面试逐字稿',
    '求职陪跑',
    '校招辅导',
    '大学生求职',
    'Offer360',
  ], SEO_COMPETITOR_BRANDS, SEO_OVERSEAS_JOB_KEYWORDS, [
    '留学生求职服务',
    '海归求职辅导',
    '超级简历替代',
    'offer先生替代',
  ]),
  seoContent: [
    'Offer360 求职服务中心致力于解决大学生、留学生与海归求职全过程中的核心痛点。',
    '我们通过整合实习校招、招聘公告、春招秋招夏招信息、校招笔试真题练习、AI 智能简历优化与面试辅导，构建了从“发现岗位”到“拿到 Offer”的全流程服务体系。',
    '无论你需要简历润色、面试技巧提升、面试逐字稿复盘还是笔试通关，在这里都能找到专业的解决方案。',
    '对于正在比较 offer先生、超级简历、粉笔、中公、华图 等品牌的用户，Offer360 更强调工具能力与求职服务协同。',
  ],
});

export default async function ServicesPage() {
  const services = await getServicesPageData();
  const servicesPageSchema = buildWebPageSchema({
    title: 'Offer360 求职服务页',
    description: '面向大学生与应届生的求职全流程服务页，覆盖 AI简历优化、面试辅导、笔试真题辅导、背景提升与求职陪跑。',
    path: '/services',
    type: 'CollectionPage',
  });
  const serviceListSchema = buildServiceListSchema(services);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(servicesPageSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceListSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            buildBreadcrumbSchema([
              { name: '首页', path: '/' },
              { name: '求职服务', path: '/services' },
            ]),
          ),
        }}
      />
      <main className="mx-auto max-w-[1366px] px-4 py-8 lg:px-8">
        <ServiceGrid services={services} />
        <SeoHiddenContent
          title="求职服务页 SEO 隐藏内容"
          paragraphs={[
            'Offer360 为大学生、留学生与海归提供一站式求职全流程服务，覆盖实习校招、招聘公告、春招、秋招、夏招，以及 AI 简历优化、面试辅导、校招笔试真题和面试逐字稿等核心场景。',
            '对于正在比较 offer先生、超级简历、粉笔、中公、华图 等品牌的用户，Offer360 更强调岗位信息、AI 工具与求职服务协同的一体化体验。',
          ]}
        />
        <SeoLinkCluster
          currentPath="/services"
          className="mt-8"
          title="相关核心栏目"
          description="求职服务与名企校招、笔试真题、AI简历优化、面试辅导形成完整闭环，方便用户按阶段进入对应页面。"
        />
      </main>
    </>
  );
}
