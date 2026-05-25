'use client';

interface SiteBeianFooterProps {
  className?: string;
}

export function SiteBeianFooter({ className = '' }: SiteBeianFooterProps) {
  return (
    <div className={`px-4 pb-8 pt-2 ${className}`.trim()}>
      <div className="mx-auto flex max-w-[980px] flex-wrap items-center justify-center gap-x-3 gap-y-2 text-center text-xs leading-5 text-slate-500">
        <span>天津市南开区名途教育科技工作室</span>
        <span>ICP备案/许可证号:津ICP备2026002780号</span>
        <span className="inline-flex items-center gap-1">
          <img
            src="https://beian.mps.gov.cn/web/assets/logo01.6189a29f.png"
            alt="公安备案logo"
            className="h-4 w-4 object-contain"
          />
          <span>津公网安备12010402002488号</span>
        </span>
      </div>
    </div>
  );
}
