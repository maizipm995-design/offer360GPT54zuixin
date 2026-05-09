'use client';

import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { ServiceItem } from '@/types';

export function ServiceGrid({ services }: { services: ServiceItem[] }) {
  const router = useRouter();

  return (
    <section className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
      {services.map((item) => (
        <Card key={item.id} className="flex flex-col p-5 transition hover:-translate-y-0.5 hover:shadow-card">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-ink">{item.name}</h2>
            {item.isHot ? <Badge>热销</Badge> : null}
          </div>
          <p className="mt-4 min-h-[96px] text-sm leading-7 text-muted">{item.description}</p>
          <div className="mt-6 space-y-2">
            <p className="text-2xl font-bold text-brand">{formatCurrency(item.price)}</p>
            <p className="text-sm text-muted line-through">原价 {formatCurrency(item.originalPrice)}</p>
            <p className="text-sm text-muted">评分 {item.score} · {item.salesCount} 人付款</p>
          </div>
          <Button className="mt-6 w-full" onClick={() => router.push(`/services/${encodeURIComponent(item.id)}`)}>
            查看详情
          </Button>
        </Card>
      ))}
    </section>
  );
}
