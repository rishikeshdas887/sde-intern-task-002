import { UserPlus, X } from 'lucide-react'
import type React from 'react'
import { useState } from 'react'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSubmit: (name: string) => Promise<void>
  isSubmitting: boolean
  homeName: string
}

export function AddMemberModal({ isOpen, onClose, onSubmit, isSubmitting, homeName }: Props) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Member name cannot be empty')
      return
    }
    setError(null)
    try {
      await onSubmit(trimmed)
      setName('')
      onClose()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to add member'
      setError(message)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-member-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
    >
      <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-2xl text-slate-100 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
              <UserPlus className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <h2 id="add-member-title" className="text-base font-semibold">
                Add Roommate
              </h2>
              <p className="text-xs text-slate-400">Joining {homeName}</p>
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
              htmlFor="member-name-input"
              className="block text-xs font-medium text-slate-400 mb-1.5"
            >
              Roommate Name
            </label>
            <input
              id="member-name-input"
              type="text"
              required
              maxLength={100}
              placeholder="e.g. Asha, Ben, Chitra"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

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
              disabled={isSubmitting || !name.trim()}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition shadow-sm disabled:opacity-50"
            >
              {isSubmitting ? 'Adding...' : 'Add Roommate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
