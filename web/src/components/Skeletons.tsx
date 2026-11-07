import { motion } from 'framer-motion'

export function DashboardSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="status"
      className="space-y-8 animate-pulse-subtle"
      aria-busy="true"
      aria-label="Loading dashboard"
    >
      {/* Hero Metric Card Skeleton */}
      <div className="rounded-2xl border border-slate-200/80 bg-white/50 dark:border-slate-800/80 dark:bg-slate-900/50 p-6 md:p-8 backdrop-blur-md">
        <div className="h-4 w-48 rounded-lg bg-slate-200 dark:bg-slate-800/90" />
        <div className="mt-4 h-12 w-64 rounded-xl bg-slate-200/80 dark:bg-slate-800/80" />
        <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800/60">
          <div className="h-3 w-36 rounded bg-slate-200/70 dark:bg-slate-800/70 mb-4" />
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <div className="h-16 rounded-xl bg-slate-200/50 dark:bg-slate-800/50" />
            <div className="h-16 rounded-xl bg-slate-200/50 dark:bg-slate-800/50" />
            <div className="h-16 rounded-xl bg-slate-200/50 dark:bg-slate-800/50" />
          </div>
        </div>
      </div>

      {/* Bills Header Skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-6 w-36 rounded-lg bg-slate-200 dark:bg-slate-800/80" />
        <div className="h-8 w-56 rounded-xl bg-slate-200/70 dark:bg-slate-800/60" />
      </div>

      {/* Bill Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-slate-200/80 bg-white/40 dark:border-slate-800/80 dark:bg-slate-900/40 p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="h-5 w-48 rounded bg-slate-200 dark:bg-slate-800/80" />
                <div className="h-3 w-28 rounded bg-slate-200/70 dark:bg-slate-800/60" />
              </div>
              <div className="h-6 w-20 rounded-lg bg-slate-200 dark:bg-slate-800/70" />
            </div>
            <div className="h-2 w-full rounded-full bg-slate-200/60 dark:bg-slate-800/60" />
            <div className="pt-2 space-y-2">
              <div className="h-12 rounded-xl bg-slate-200/40 dark:bg-slate-800/40" />
              <div className="h-12 rounded-xl bg-slate-200/40 dark:bg-slate-800/40" />
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  )
}
