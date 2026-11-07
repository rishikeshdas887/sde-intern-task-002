import { AnimatePresence, motion } from 'framer-motion'
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
    <motion.div
      whileHover={{ scale: 1.008, x: 2 }}
      transition={{ duration: 0.15 }}
      className="py-2.5 px-3.5 rounded-xl bg-slate-50 hover:bg-slate-100/90 border border-slate-200/80 hover:border-slate-300 dark:bg-slate-900/50 dark:hover:bg-slate-900/80 dark:border-slate-800/50 dark:hover:border-slate-700/60 transition shadow-sm flex flex-col gap-2"
    >
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
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              {memberName}
            </span>
            {isPaid && formattedPaidTime && (
              <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                Paid {formattedPaidTime}
              </span>
            )}
          </div>
        </div>

        {/* Right: Amount & Status / Pay Button */}
        <div className="flex items-center gap-3">
          <span className="tabular-nums font-mono font-semibold text-sm text-slate-900 dark:text-slate-100">
            {formatCents(share.amountCents)}
          </span>

          {isPaid ? (
            <motion.span
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 25 }}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 shadow-sm"
            >
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              Paid
            </motion.span>
          ) : (
            <motion.button
              type="button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handlePay}
              disabled={isPending}
              aria-busy={isPending}
              aria-label={`Pay ${formatCents(share.amountCents)} share for ${memberName}`}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-900 cursor-pointer ${
                error
                  ? 'bg-amber-600 hover:bg-amber-500 text-white focus:ring-amber-500 shadow-amber-600/20'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white focus:ring-indigo-500 shadow-indigo-600/20'
              } disabled:opacity-60 disabled:cursor-not-allowed`}
            >
              {isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  <span>Paying...</span>
                </>
              ) : error ? (
                <>
                  <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Retry Pay</span>
                </>
              ) : (
                <span>Mark Paid</span>
              )}
            </motion.button>
          )}
        </div>
      </div>

      {/* Inline Payment Error Notice */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            role="alert"
            className="flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 px-2.5 py-1.5 rounded-lg border border-rose-200 dark:border-rose-500/20"
          >
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
