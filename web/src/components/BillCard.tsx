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
    <article
      className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm transition hover:border-slate-700/80"
      aria-labelledby={`bill-title-${bill.id}`}
    >
      {/* Bill Card Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 id={`bill-title-${bill.id}`} className="text-base font-semibold text-slate-100">
              {bill.title}
            </h3>
            {isFullySettled ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                <CheckCircle2 className="h-3 w-3" />
                Fully Settled
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30">
                <Clock className="h-3 w-3" />
                {totalShares - paidCount} Unpaid
              </span>
            )}
          </div>
          {formattedDate && <p className="mt-1 text-xs text-slate-400">Created {formattedDate}</p>}
        </div>

        <div className="text-right">
          <span className="tabular-nums font-mono font-bold text-lg text-slate-100">
            {formatCents(bill.totalCents)}
          </span>
          <span className="block text-[11px] text-slate-400">
            {paidCount} of {totalShares} paid ({percentPaid}%)
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mt-4">
        <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              isFullySettled ? 'bg-emerald-500' : 'bg-indigo-500'
            }`}
            style={{ width: `${percentPaid}%` }}
            role="progressbar"
            aria-valuenow={percentPaid}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${percentPaid}% of bill paid`}
          />
        </div>
      </div>

      {/* Itemized Shares List */}
      <div className="mt-4 space-y-2">
        <h4 className="text-xs font-semibold tracking-wider uppercase text-slate-400 px-1">
          Member Shares
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
    </article>
  )
}
