import { motion } from 'framer-motion'
import { CheckCircle2, Clock } from 'lucide-react'
import type { BillWithShares, MemberItem } from '../api'
import { formatCents } from '../lib/format'
import { ShareRow } from './ShareRow'

interface Props {
  bill: BillWithShares
  members: MemberItem[]
  onPayShare: (billId: string, shareId: string, idempotencyKey: string) => Promise<void>
}

export function BillCard({ bill, members, onPayShare }: Props) {
  const memberMap = new Map<string, string>(members.map((m) => [m.id, m.name]))

  // Calculate payment progress
  const totalShares = bill.shares.length
  const paidShares = bill.shares.filter((s) => s.paidAt !== null)
  const paidCount = paidShares.length
  const paidCents = paidShares.reduce((acc, s) => acc + s.amountCents, 0)

  const percentPaid = bill.totalCents > 0 ? Math.round((paidCents / bill.totalCents) * 100) : 0
  const isFullySettled = paidCount === totalShares && totalShares > 0

  const formattedDate = bill.createdAt
    ? new Date(bill.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      whileHover={{ y: -3, borderColor: 'rgb(99 102 241 / 0.5)' }}
      transition={{ duration: 0.25 }}
      className="rounded-2xl border border-slate-200/90 bg-white/90 hover:bg-white hover:border-slate-300 dark:border-slate-800/90 dark:bg-slate-900/60 dark:hover:bg-slate-900/80 backdrop-blur-md p-5 sm:p-6 shadow-sm hover:shadow-md dark:shadow-md dark:hover:shadow-lg transition-colors ring-1 ring-slate-900/5 dark:ring-white/5"
      aria-labelledby={`bill-title-${bill.id}`}
    >
      {/* Bill Card Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3
              id={`bill-title-${bill.id}`}
              className="text-base font-bold text-slate-900 dark:text-slate-100"
            >
              {bill.title}
            </h3>
            {isFullySettled ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30">
                <CheckCircle2 className="h-3 w-3" />
                Fully Settled
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30">
                <Clock className="h-3 w-3" />
                {totalShares - paidCount} Unpaid
              </span>
            )}
          </div>
          {formattedDate && (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Created {formattedDate}
            </p>
          )}
        </div>

        <div className="text-right">
          <span className="tabular-nums font-mono font-extrabold text-lg sm:text-xl text-slate-900 dark:text-slate-100 block">
            {formatCents(bill.totalCents)}
          </span>
          <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
            {paidCount} of {totalShares} paid ({percentPaid}%)
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mt-4">
        <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800/80 overflow-hidden ring-1 ring-slate-900/5 dark:ring-white/5">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percentPaid}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className={`h-full ${
              isFullySettled
                ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                : 'bg-gradient-to-r from-indigo-500 to-violet-500'
            }`}
            role="progressbar"
            aria-valuenow={percentPaid}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${percentPaid}% of bill paid`}
          />
        </div>
      </div>

      {/* Itemized Shares List */}
      <div className="mt-5 space-y-2">
        <h4 className="text-[11px] font-bold tracking-wider uppercase text-slate-500 dark:text-slate-400 px-1">
          Roommate Shares (Remainder Distributed to Early Joiners)
        </h4>
        <div className="space-y-1.5">
          {bill.shares.map((share) => {
            const memberName = memberMap.get(share.memberId) ?? share.memberName ?? 'Member'
            return (
              <ShareRow
                key={share.id}
                share={share}
                billId={bill.id}
                onPay={onPayShare}
                memberName={memberName}
              />
            )
          })}
        </div>
      </div>
    </motion.article>
  )
}
