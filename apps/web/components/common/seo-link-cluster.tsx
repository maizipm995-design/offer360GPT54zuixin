import Link from 'next/link';
import { CORE_SITE_LINKS } from '@/lib/seo';

export function SeoLinkCluster({
  title = '核心求职栏目',
  description = '围绕名企校招、笔试真题、AI简历优化、面试辅导与求职服务建立站内互链，帮助用户与搜索引擎更快理解站点结构。',
  currentPath,
  className,
}: {
  title?: string;
  description?: string;
  currentPath?: string;
  className?: string;
}) {
  const linkItems = CORE_SITE_LINKS.filter((item) => item.path !== currentPath);

  return (
    <nav aria-hidden="true" data-seo-hidden="true" className={`sr-only ${className ?? ''}`} aria-label={title}>
      <p>{title}</p>
      <p>{description}</p>
      <div>
        {linkItems.map((item) => (
          <Link key={item.path} href={item.path}>
            {item.label} {item.description}
          </Link>
        ))}
      </div>
    </nav>
  );
}
