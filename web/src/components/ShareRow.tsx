import { AlertCircle, Check, Loader2, RotateCw } from 'lucide-react'
import { useRef, useState } from 'react'
import type { ShareItem } from '../api'
import { formatCents, getAvatarInfo } from '../lib/format'

interface Props {
  share: ShareItem
  billId: string
  onPay: (billId: string, shareId: string, idempotencyKey: string) => Promise<void>
  memberName: string
}

export function ShareRow({ share, billId, onPay, memberName }: Props) {
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Store idempotency key per payment attempt: generated once, reused on retry of the same attempt!
  const idempotencyKeyRef = useRef<string | null>(null)

  const isPaid = share.paidAt !== null
  const { initials, palette } = getAvatarInfo(memberName)

  const handlePay = async () => {
    if (isPending || isPaid) return

    // Generate idempotency key if not already generated for this payment attempt
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = crypto.randomUUID()
    }

    setIsPending(true)
    setError(null)

    try {
      await onPay(billId, share.id, idempotencyKeyRef.current)
      // Clear attempt key on success so future transactions (if any) would use a new key
      idempotencyKeyRef.current = null
    } catch (err: unknown) {
      // Retain idempotencyKeyRef.current so the user can retry with the exact same key!
      const message = err instanceof Error ? err.message : 'Payment failed'
      setError(message)
    } finally {
      setIsPending(false)
    }
  }

  const formattedPaidTime = share.paidAt
    ? new Date(share.paidAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null

  return (
    <div className="py-2.5 px-3 rounded-lg bg-slate-900/40 hover:bg-slate-900/70 border border-slate-800/40 transition flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* Left: Avatar & Member Name */}
        <div className="flex items-center gap-2.5 min-w-[140px]">
          <div
            className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold border ${palette.bg} ${palette.text} ${palette.border}`}
            aria-hidden="true"
          >
            {initials}
          </div>
          <div>
            <span className="text-sm font-medium text-slate-200">{memberName}</span>
            {isPaid && formattedPaidTime && (
              <span className="block text-[11px] text-slate-500">Paid {formattedPaidTime}</span>
            )}
          </div>
        </div>

        {/* Right: Amount & Status / Pay Button */}
        <div className="flex items-center gap-3">
          <span className="tabular-nums font-mono font-medium text-sm text-slate-100">
            {formatCents(share.amountCents)}
          </span>

          {isPaid ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              Paid
            </span>
          ) : (
            <button
              type="button"
              onClick={handlePay}
              disabled={isPending}
              aria-busy={isPending}
              aria-label={`Pay ${formatCents(share.amountCents)} share for ${memberName}`}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                error
                  ? 'bg-amber-600 hover:bg-amber-500 text-white focus:ring-amber-500'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white focus:ring-indigo-500'
              } disabled:opacity-60 disabled:cursor-not-allowed`}
            >
              {isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  Paying...
                </>
              ) : error ? (
                <>
                  <RotateCw className="h-3 w-3" aria-hidden="true" />
                  Retry Pay
                </>
              ) : (
                'Pay Share'
              )}
            </button>
          )}
        </div>
      </div>

      {/* Inline Payment Error Alert */}
      {error && !isPaid && (
        <div
          role="alert"
          aria-live="polite"
          className="flex items-center gap-1.5 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/25 px-2.5 py-1.5 rounded-md mt-1"
        >
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>Payment failed: {error}. Click "Retry Pay" to attempt again.</span>
        </div>
      )}
    </div>
  )
}
