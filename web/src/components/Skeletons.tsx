export function DashboardSkeleton() {
  return (
    <div
      role="status"
      className="space-y-8 animate-pulse-subtle"
      aria-busy="true"
      aria-label="Loading dashboard"
    >
      {/* Hero Metric Card Skeleton */}
      <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-6 md:p-8">
        <div className="h-4 w-48 rounded bg-slate-800" />
        <div className="mt-4 h-12 w-64 rounded bg-slate-800" />
        <div className="mt-6 pt-6 border-t border-slate-800/60">
          <div className="h-3 w-36 rounded bg-slate-800/80 mb-4" />
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <div className="h-14 rounded-lg bg-slate-800/60" />
            <div className="h-14 rounded-lg bg-slate-800/60" />
            <div className="h-14 rounded-lg bg-slate-800/60" />
          </div>
        </div>
      </div>

      {/* Bills Header Skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-6 w-32 rounded bg-slate-800" />
        <div className="h-8 w-48 rounded bg-slate-800/60" />
      </div>

      {/* Bill Cards Skeleton */}
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="h-5 w-48 rounded bg-slate-800" />
                <div className="h-3 w-28 rounded bg-slate-800/60" />
              </div>
              <div className="h-6 w-20 rounded bg-slate-800" />
            </div>
            <div className="h-2 w-full rounded-full bg-slate-800" />
            <div className="pt-2 space-y-2">
              <div className="h-10 rounded-lg bg-slate-800/40" />
              <div className="h-10 rounded-lg bg-slate-800/40" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
