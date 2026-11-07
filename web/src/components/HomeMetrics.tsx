import { motion } from 'framer-motion'
import { CheckCircle2, TrendingDown, Users, Wallet } from 'lucide-react'
import type { MemberBalance } from '../api'
import { formatCents, getAvatarInfo } from '../lib/format'

interface Props {
  balances: MemberBalance[]
  homeName: string
}

export function HomeMetrics({ balances, homeName }: Props) {
  const totalOutstandingCents = balances.reduce((sum, b) => sum + b.outstandingCents, 0)

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      aria-labelledby="metrics-heading"
      className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white/90 dark:border-slate-800/90 dark:bg-gradient-to-b dark:from-slate-900/90 dark:via-slate-900/70 dark:to-slate-950/80 backdrop-blur-xl p-6 md:p-8 shadow-md dark:shadow-xl ring-1 ring-slate-900/5 dark:ring-white/5 transition-colors duration-200"
    >
      {/* Ambient background glow */}
      <div
        className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-indigo-500/10 dark:bg-indigo-600/10 blur-3xl"
        aria-hidden="true"
      />

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-slate-200 dark:border-slate-800/80">
        <div>
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20 mb-3"
          >
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{homeName}</span>
            <span className="text-slate-300 dark:text-slate-600">•</span>
            <span>
              {balances.length} Roommate{balances.length === 1 ? '' : 's'}
            </span>
          </motion.div>

          <h2
            id="metrics-heading"
            className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
          >
            Total Household Outstanding
          </h2>

          <div className="mt-2 flex items-baseline gap-3 flex-wrap">
            <motion.span
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              className="tabular-nums font-mono font-extrabold text-4xl md:text-5xl text-slate-900 dark:text-slate-50 tracking-tight"
            >
              {formatCents(totalOutstandingCents)}
            </motion.span>

            {totalOutstandingCents === 0 ? (
              <motion.span
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 shadow-sm"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                All Settled Up
              </motion.span>
            ) : (
              <motion.span
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30 shadow-sm"
              >
                <TrendingDown className="h-3.5 w-3.5" />
                Unpaid Shares
              </motion.span>
            )}
          </div>
        </div>

        <div className="hidden md:flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-950/50 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800/60">
          <Wallet className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          <span>Fair split automatically calculated in join order</span>
        </div>
      </div>

      {/* Member Balances Breakdown */}
      <div className="mt-6">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3.5">
          Member Balance Breakdown (Join Order)
        </h3>

        {balances.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 italic">
            No members in this home yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {balances.map((b, idx) => {
              const { initials, palette } = getAvatarInfo(b.name)
              const isSettled = b.outstandingCents === 0

              return (
                <motion.div
                  key={b.memberId}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * idx, duration: 0.3 }}
                  whileHover={{
                    y: -3,
                    scale: 1.015,
                    boxShadow: '0 8px 20px -6px rgba(0, 0, 0, 0.1)',
                  }}
                  className="group flex items-center justify-between p-3.5 rounded-xl border border-slate-200/90 bg-white/80 hover:bg-white hover:border-slate-300 dark:border-slate-800/80 dark:bg-slate-950/60 dark:hover:bg-slate-950 dark:hover:border-slate-700/80 transition shadow-sm cursor-default"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold border transition group-hover:scale-105 ${palette.bg} ${palette.text} ${palette.border}`}
                      aria-hidden="true"
                    >
                      {initials}
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-slate-800 group-hover:text-slate-950 dark:text-slate-200 dark:group-hover:text-white transition">
                        {b.name}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                        {isSettled ? 'Zero balance' : 'Owes to household'}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span
                      className={`tabular-nums font-mono font-bold text-sm block ${
                        isSettled
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-slate-900 dark:text-slate-100'
                      }`}
                    >
                      {formatCents(b.outstandingCents)}
                    </span>
                    {isSettled && (
                      <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-500/90 block">
                        Settled
                      </span>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </motion.section>
  )
}
