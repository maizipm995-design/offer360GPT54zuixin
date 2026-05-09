import { ServiceGrid } from '@/components/services/service-grid';
import { serverGet } from '@/lib/api';
import { ServiceItem } from '@/types';

export default async function ServicesPage() {
  const services = await serverGet<ServiceItem[]>('/service-products');

  return (
    <main className="mx-auto max-w-[1366px] px-4 py-8 lg:px-8">
      <section className="rounded-[32px] bg-white px-6 py-10 text-center shadow-card lg:px-10 lg:py-14">
        <p className="text-sm font-semibold uppercase tracking-[0.35em] text-brand">求职服务</p>
        <h1 className="mt-4 text-4xl font-bold text-ink">专业的求职辅导服务，助你快速拿到心仪 offer</h1>
        <p className="mx-auto mt-4 max-w-3xl text-sm leading-7 text-muted lg:text-base">
          覆盖简历优化、面试辅导、笔试辅助、职业规划、内推服务等全流程求职支持，所有卡片均接入真实商品与订单接口。
        </p>
      </section>
      <ServiceGrid services={services} />
      <section className="mt-8 rounded-2xl bg-[#fff3e6] px-6 py-5 text-center text-sm text-brand">
        点击“查看详情”可查看商品详细信息和购买入口，帮助用户完成服务转化。
      </section>
    </main>
  );
}
