import { AnimatePresence, motion } from 'framer-motion'
import { DollarSign, Receipt, RefreshCw, Sparkles, X } from 'lucide-react'
import type React from 'react'
import { useMemo, useState } from 'react'
import type { MemberItem } from '../api'
import { formatCents, getAvatarInfo } from '../lib/format'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSubmit: (title: string, totalCents: number) => Promise<void>
  isSubmitting: boolean
  members: MemberItem[]
}

export function CreateBillModal({ isOpen, onClose, onSubmit, isSubmitting, members }: Props) {
  const [title, setTitle] = useState('')
  const [amountStr, setAmountStr] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Compute total cents from amount input safely
  const totalCents = useMemo(() => {
    const parsed = Number.parseFloat(amountStr)
    if (Number.isNaN(parsed) || parsed <= 0) return 0
    return Math.round(parsed * 100)
  }, [amountStr])

  // Compute live split preview
  const splitPreview = useMemo(() => {
    if (members.length === 0 || totalCents <= 0) return []
    const n = members.length
    const base = Math.floor(totalCents / n)
    const remainder = totalCents % n

    return members.map((m, idx) => ({
      member: m,
      cents: idx < remainder ? base + 1 : base,
      hasExtraCent: idx < remainder,
    }))
  }, [members, totalCents])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      setError('Bill title cannot be empty')
      return
    }
    if (totalCents <= 0 || !Number.isSafeInteger(totalCents)) {
      setError('Please enter a valid positive dollar amount')
      return
    }
    if (members.length === 0) {
      setError('Cannot split a bill for a home with no members')
      return
    }

    setError(null)
    try {
      await onSubmit(trimmedTitle, totalCents)
      setTitle('')
      setAmountStr('')
      onClose()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create bill'
      setError(message)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-bill-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-md"
          />

          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white text-slate-900 dark:border-slate-800 dark:bg-slate-900/95 dark:text-slate-100 p-6 shadow-2xl my-8 ring-1 ring-slate-900/5 dark:ring-white/10"
          >
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20">
                  <Receipt className="h-4 w-4" aria-hidden="true" />
                </div>
                <div>
                  <h2
                    id="create-bill-title"
                    className="text-base font-bold text-slate-900 dark:text-slate-100"
                  >
                    Split New Bill
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Split equally among {members.length} roommate{members.length === 1 ? '' : 's'}
                  </p>
                </div>
              </div>
              <motion.button
                type="button"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={onClose}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                aria-label="Close modal"
              >
                <X className="h-5 w-5" />
              </motion.button>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    role="alert"
                    className="rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400 font-medium"
                  >
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              <div>
                <label
                  htmlFor="bill-title-input"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5"
                >
                  Bill Description
                </label>
                <input
                  id="bill-title-input"
                  type="text"
                  required
                  maxLength={100}
                  placeholder="e.g. WiFi & Fiber, March Groceries, Electricity"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 text-slate-900 placeholder-slate-400 dark:border-slate-700/80 dark:bg-slate-950 dark:text-slate-100 dark:placeholder-slate-500 px-3.5 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition shadow-inner"
                />
              </div>

              <div>
                <label
                  htmlFor="bill-amount-input"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5"
                >
                  Total Amount ($ USD)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                    <DollarSign className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <input
                    id="bill-amount-input"
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0.00"
                    value={amountStr}
                    onChange={(e) => setAmountStr(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 placeholder-slate-400 dark:border-slate-700/80 dark:bg-slate-950 dark:text-slate-100 dark:placeholder-slate-500 text-sm font-mono focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition shadow-inner tabular-nums"
                  />
                </div>
              </div>

              {/* Dynamic Live Split Preview */}
              {splitPreview.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="rounded-xl border border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-950/70 p-3.5 space-y-2.5"
                >
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
                    <span className="flex items-center gap-1.5 font-semibold text-indigo-600 dark:text-indigo-400">
                      <Sparkles className="h-3.5 w-3.5" />
                      Deterministic Split Preview
                    </span>
                    <span className="tabular-nums font-mono">Sum: {formatCents(totalCents)}</span>
                  </div>

                  <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                    {splitPreview.map(({ member, cents, hasExtraCent }) => {
                      const { initials, palette } = getAvatarInfo(member.name)
                      return (
                        <div
                          key={member.id}
                          className="flex items-center justify-between py-1.5 px-2 rounded-lg border border-slate-200/80 bg-white dark:border-transparent dark:bg-slate-900/60 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold border ${palette.bg} ${palette.text} ${palette.border}`}
                            >
                              {initials}
                            </div>
                            <span className="text-slate-800 dark:text-slate-200 font-medium">
                              {member.name}
                            </span>
                            {hasExtraCent && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300 font-mono">
                                +1¢ remainder
                              </span>
                            )}
                          </div>
                          <span className="tabular-nums font-mono font-bold text-slate-900 dark:text-slate-200">
                            {formatCents(cents)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </motion.div>
              )}

              <div className="flex justify-end gap-3 pt-3">
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition disabled:opacity-50"
                >
                  Cancel
                </motion.button>
                <motion.button
                  type="submit"
                  whileHover={{ scale: 1.03, boxShadow: '0 8px 20px -4px rgba(99, 102, 241, 0.4)' }}
                  whileTap={{ scale: 0.97 }}
                  disabled={isSubmitting || members.length === 0}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-indigo-600/30 transition disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin text-white" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    'Split & Save Bill'
                  )}
                </motion.button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
