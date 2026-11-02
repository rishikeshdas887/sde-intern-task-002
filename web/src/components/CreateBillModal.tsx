import { DollarSign, Receipt, X } from 'lucide-react'
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
    }))
  }, [members, totalCents])

  if (!isOpen) return null

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
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-bill-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto"
    >
      <div className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-2xl text-slate-100 animate-in fade-in zoom-in-95 duration-150 my-8">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-400">
              <Receipt className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <h2 id="create-bill-title" className="text-base font-semibold">
                Split New Bill
              </h2>
              <p className="text-xs text-slate-400">
                Split equally among {members.length} member{members.length === 1 ? '' : 's'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {error && (
            <div
              role="alert"
              className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-400"
            >
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="bill-title-input"
              className="block text-xs font-medium text-slate-400 mb-1.5"
            >
              Bill Title / Description
            </label>
            <input
              id="bill-title-input"
              type="text"
              required
              maxLength={200}
              placeholder="e.g. Fiber Internet, Groceries, Electricity"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label
              htmlFor="bill-amount-input"
              className="block text-xs font-medium text-slate-400 mb-1.5"
            >
              Total Amount ($ USD)
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                <DollarSign className="h-4 w-4" />
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
                className="w-full rounded-lg border border-slate-700 bg-slate-950 pl-9 pr-4 py-2.5 text-sm tabular-nums text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Live Split Breakdown Preview */}
          {splitPreview.length > 0 && (
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                <span>Split Breakdown ({members.length} members)</span>
                <span className="tabular-nums font-semibold text-slate-200">
                  Total: {formatCents(totalCents)}
                </span>
              </div>
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {splitPreview.map(({ member, cents }) => {
                  const { initials, palette } = getAvatarInfo(member.name)
                  return (
                    <div
                      key={member.id}
                      className="flex items-center justify-between py-1 px-2 rounded bg-slate-900/60 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${palette.bg} ${palette.text}`}
                        >
                          {initials}
                        </div>
                        <span className="text-slate-300 font-medium">{member.name}</span>
                      </div>
                      <span className="tabular-nums font-mono text-slate-200">
                        {formatCents(cents)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim() || totalCents <= 0}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition shadow-sm disabled:opacity-50"
            >
              {isSubmitting ? 'Splitting...' : 'Create & Split Bill'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
