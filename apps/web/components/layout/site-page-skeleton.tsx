type SitePageSkeletonProps = {
  compact?: boolean;
};

export function SitePageSkeleton({ compact = false }: SitePageSkeletonProps) {
  return (
    <main className="mx-auto max-w-[1366px] px-4 py-8 lg:px-8">
      <section className="animate-pulse rounded-[32px] bg-white px-6 py-8 shadow-card lg:px-10 lg:py-10">
        <div className="h-10 w-48 rounded-full bg-slate-200" />
        <div className="mt-4 h-4 w-full max-w-3xl rounded-full bg-slate-100" />
        <div className="mt-2 h-4 w-full max-w-2xl rounded-full bg-slate-100" />
      </section>

      <section className={`mt-8 grid gap-6 ${compact ? '' : 'xl:grid-cols-[minmax(0,1.12fr)_minmax(320px,0.88fr)]'}`}>
        <div className="space-y-6 rounded-[28px] bg-white p-6 shadow-card lg:p-8">
          <div className="h-6 w-40 animate-pulse rounded-full bg-slate-200" />
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: compact ? 4 : 6 }).map((_, index) => (
              <div key={index} className="space-y-2">
                <div className="h-4 w-24 animate-pulse rounded-full bg-slate-100" />
                <div className="h-11 animate-pulse rounded-2xl bg-slate-100" />
              </div>
            ))}
          </div>
          <div className="h-48 animate-pulse rounded-[24px] bg-slate-100" />
        </div>

        {!compact ? (
          <aside className="rounded-[28px] bg-white p-6 shadow-card lg:p-8">
            <div className="h-6 w-32 animate-pulse rounded-full bg-slate-200" />
            <div className="mt-6 space-y-4">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="rounded-2xl border border-slate-100 p-4">
                  <div className="h-4 w-2/3 animate-pulse rounded-full bg-slate-100" />
                  <div className="mt-3 h-3 w-full animate-pulse rounded-full bg-slate-100" />
                  <div className="mt-2 h-3 w-4/5 animate-pulse rounded-full bg-slate-100" />
                </div>
              ))}
            </div>
          </aside>
        ) : null}
      </section>
    </main>
  );
}
