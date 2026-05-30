'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/admin/campus-exam/categories', label: '一级分类' },
  { href: '/admin/campus-exam/specials', label: '二级分类' },
  { href: '/admin/campus-exam/import-batches', label: '导入批次' },
  { href: '/admin/campus-exam/questions', label: '题目管理' },
  { href: '/admin/campus-exam/subjective-judgements', label: '判分记录' },
  { href: '/admin/campus-exam/quality', label: '判分质检' },
] as const;

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function CampusExamAdminNav() {
  const pathname = usePathname();

  return (
    <div className="-mx-1 overflow-x-auto">
      <div className="flex min-w-max gap-2 px-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'rounded-full px-4 py-2 text-sm font-medium transition',
              isActive(pathname, item.href)
                ? 'bg-brand text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-brand/10 hover:text-brand',
            )}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
