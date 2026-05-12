import type { Metadata } from 'next';
import { ServiceGrid } from '@/components/services/service-grid';
import { serverGet } from '@/lib/api';
import { buildPageMetadata } from '@/lib/seo';
import { ServiceItem } from '@/types';

export const metadata: Metadata = buildPageMetadata({
  title: '求职服务_简历优化_面试辅导_职业规划与校招辅导',
  description: 'offer360 提供简历优化、面试辅导、职业规划、笔试辅助、内推服务等求职全流程支持，帮助大学生与应届生提升校招效率。',
  path: '/services',
  keywords: ['求职服务', '简历优化', '面试辅导', '职业规划', '校招辅导', '大学生求职服务'],
});

export default async function ServicesPage() {
  const services = await serverGet<ServiceItem[]>('/service-products');

  return (
    <main className="mx-auto max-w-[1366px] px-4 py-8 lg:px-8">
      <section className="rounded-[32px] bg-white px-6 py-10 text-center shadow-card lg:px-10 lg:py-14">
        <p className="text-sm font-semibold uppercase tracking-[0.35em] text-brand">求职服务</p>
        <h1 className="mt-4 text-4xl font-bold text-ink">简历优化、面试辅导与职业规划服务，助你更快拿到心仪 offer</h1>
        <p className="mx-auto mt-4 max-w-3xl text-sm leading-7 text-muted lg:text-base">
          offer360 提供简历优化、面试辅导、笔试辅助、职业规划、内推服务等全流程求职支持，帮助大学生和应届生提升校招求职效率。
        </p>
      </section>
      <ServiceGrid services={services} />
      <section className="mt-8 rounded-2xl bg-[#fff3e6] px-6 py-5 text-center text-sm text-brand">
        点击“查看详情”可查看商品详细信息和购买入口，帮助用户完成服务转化。
      </section>
    </main>
  );
}
