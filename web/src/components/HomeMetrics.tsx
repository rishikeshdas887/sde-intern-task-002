import { CheckCircle2, TrendingDown, Users } from 'lucide-react'
import type { MemberBalance } from '../api'
import { formatCents, getAvatarInfo } from '../lib/format'

interface Props {
  balances: MemberBalance[]
  homeName: string
}

export function HomeMetrics({ balances, homeName }: Props) {
  const totalOutstandingCents = balances.reduce((sum, b) => sum + b.outstandingCents, 0)

  return (
    <section
      aria-labelledby="metrics-heading"
      className="rounded-xl border border-slate-800 bg-slate-900/80 p-6 md:p-8 shadow-md"
    >
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-slate-800/80">
        <div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-3">
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
            {homeName} • {balances.length} Member{balances.length === 1 ? '' : 's'}
          </span>
          <h2 id="metrics-heading" className="text-sm font-medium text-slate-400">
            Total Outstanding Household Balance
          </h2>
          <div className="mt-2 flex items-baseline gap-3">
            <span className="tabular-nums font-mono font-bold text-4xl md:text-5xl text-slate-50 tracking-tight">
              {formatCents(totalOutstandingCents)}
            </span>
            {totalOutstandingCents === 0 ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                <CheckCircle2 className="h-3.5 w-3.5" />
                All Settled Up
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30">
                <TrendingDown className="h-3.5 w-3.5" />
                Unpaid Shares
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Member Balances Breakdown */}
      <div className="mt-6">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
          Member Balance Breakdown (Join Order)
        </h3>

        {balances.length === 0 ? (
          <p className="text-sm text-slate-400 italic">No members in this home yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {balances.map((b) => {
              const { initials, palette } = getAvatarInfo(b.name)
              const isSettled = b.outstandingCents === 0

              return (
                <div
                  key={b.memberId}
                  className="flex items-center justify-between p-3.5 rounded-lg border border-slate-800/80 bg-slate-950/60 hover:bg-slate-950 transition"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold border ${palette.bg} ${palette.text} ${palette.border}`}
                      aria-hidden="true"
                    >
                      {initials}
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-slate-200 block">{b.name}</span>
                      <span className="text-[11px] text-slate-400 block">
                        {isSettled ? 'Zero balance' : 'Owes to household'}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span
                      className={`tabular-nums font-mono font-bold text-sm block ${
                        isSettled ? 'text-emerald-400' : 'text-slate-100'
                      }`}
                    >
                      {formatCents(b.outstandingCents)}
                    </span>
                    {isSettled && (
                      <span className="text-[10px] font-medium text-emerald-500/90 block">
                        Settled
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
