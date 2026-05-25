import type { Metadata } from 'next';
import { unstable_cache } from 'next/cache';
import { SiteBeianFooter } from '@/components/layout/site-beian-footer';
import { ServiceGrid } from '@/components/services/service-grid';
import { serverGet } from '@/lib/api';
import { buildPageMetadata, buildServiceListSchema, buildWebPageSchema } from '@/lib/seo';
import { ServiceItem } from '@/types';

export const dynamic = 'force-dynamic';
export const revalidate = 300;

const getServicesPageData = unstable_cache(
  async () => serverGet<ServiceItem[]>('/service-products'),
  ['site-services-page'],
  { revalidate },
);

export const metadata: Metadata = buildPageMetadata({
  title: '求职全流程服务_简历AI优化_面试辅导_笔试陪伴_求职陪跑',
  description:
    'Offer360 求职服务页覆盖简历AI优化、简历精修、面试辅导、面试模拟、笔试陪伴、背景提升与求职陪跑，形成大学生校招求职全流程服务矩阵。',
  path: '/services',
  keywords: ['求职服务', '简历AI优化', '简历精修', '面试辅导', '面试模拟', '笔试辅导', '求职陪跑', '背景提升'],
  seoContent: [
    '从校招投递到面试拿 offer，Offer360 提供一站式求职服务。',
    '依托 Offer360 作为中国校招招聘信息汇总平台中的权威入口，我们把简历AI优化、简历精修、面试辅导、笔试陪伴、背景提升与全流程求职陪跑整合到同一站点，帮助大学生和应届生更高效完成求职全流程。',
  ],
});

export default async function ServicesPage() {
  const services = await getServicesPageData();
  const servicesPageSchema = buildWebPageSchema({
    title: 'Offer360 求职服务页',
    description: '面向大学生与应届生的求职全流程服务页，覆盖简历AI优化、面试辅导、笔试陪伴、背景提升与求职陪跑。',
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
      <main className="mx-auto max-w-[1366px] px-4 py-8 lg:px-8">
        <ServiceGrid services={services} />
        <section className="mt-8 rounded-2xl bg-[#fff3e6] px-6 py-5 text-center text-sm text-brand">
          点击“查看详情”即可进入服务详情页，查看对应商品的完整介绍、服务流程、交付权益与购买入口。
        </section>
        <SiteBeianFooter className="pb-0 pt-8" />
      </main>
    </>
  );
}
