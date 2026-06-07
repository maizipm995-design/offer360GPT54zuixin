import { cn } from '@/lib/utils';

export function SeoHiddenContent({
  title,
  paragraphs = [],
  keywords = [],
  className,
}: {
  title?: string;
  paragraphs?: string[];
  keywords?: string[];
  className?: string;
}) {
  const normalizedParagraphs = paragraphs.filter(Boolean);
  const normalizedKeywords = keywords.filter(Boolean);

  if (!title && normalizedParagraphs.length === 0 && normalizedKeywords.length === 0) {
    return null;
  }

  return (
    <section aria-hidden="true" data-seo-hidden="true" className={cn('sr-only', className)}>
      {title ? <h2>{title}</h2> : null}
      {normalizedParagraphs.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
      {normalizedKeywords.length > 0 ? <p>{normalizedKeywords.join('，')}</p> : null}
    </section>
  );
}
