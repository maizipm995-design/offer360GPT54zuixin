import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils';
import { ServiceItem } from '@/types';

export function ServiceGrid({ services }: { services: ServiceItem[] }) {
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
            {item.originalPrice > item.price ? (
              <p className="text-sm text-muted line-through">原价 {formatCurrency(item.originalPrice)}</p>
            ) : null}
            {item.score > 0 || item.salesCount > 0 ? (
              <p className="text-sm text-muted">
                {item.score > 0 ? `评分 ${item.score}` : '正式上架'}
                {item.salesCount > 0 ? ` · ${item.salesCount} 人付款` : ''}
              </p>
            ) : null}
          </div>
          <Link
            href={`/services/${encodeURIComponent(item.id)}`}
            className={cn(
              'mt-6 inline-flex w-full items-center justify-center rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white shadow-card transition hover:bg-brand-dark active:scale-[0.98]',
            )}
          >
            查看详情
          </Link>
        </Card>
      ))}
    </section>
  );
}
