import { Button } from '@/components/ui/button';

export function AdminPagination({
  page,
  limit,
  total,
  onPageChange,
}: {
  page: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(Math.ceil(total / Math.max(limit, 1)), 1);

  return (
    <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
      <p>
        第 <span className="font-semibold text-ink">{page}</span> / <span className="font-semibold text-ink">{totalPages}</span> 页，共{' '}
        <span className="font-semibold text-ink">{total}</span> 条
      </p>
      <div className="flex items-center gap-2">
        <Button variant="secondary" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          上一页
        </Button>
        <Button variant="secondary" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          下一页
        </Button>
      </div>
    </div>
  );
}
