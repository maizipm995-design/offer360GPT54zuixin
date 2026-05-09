import { Card } from '@/components/ui/card';

export function AdminTable({
  headers,
  children,
  hasData,
  emptyText = '暂无数据',
}: {
  headers: string[];
  children: React.ReactNode;
  hasData: boolean;
  emptyText?: string;
}) {
  return (
    <Card className="overflow-hidden rounded-3xl border border-slate-200 shadow-none">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead className="bg-slate-50">
            <tr>
              {headers.map((header) => (
                <th key={header} className="whitespace-nowrap border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hasData ? (
              children
            ) : (
              <tr>
                <td colSpan={headers.length} className="px-4 py-12 text-center text-sm text-muted">
                  {emptyText}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
