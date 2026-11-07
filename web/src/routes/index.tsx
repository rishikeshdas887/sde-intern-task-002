import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Home as HomeIcon, Sparkles, Wallet } from 'lucide-react'
import type React from 'react'
import { useEffect, useState } from 'react'
import { api } from '../api'
import { DashboardSkeleton } from '../components/Skeletons'

export const Route = createFileRoute('/')({
  component: IndexPage,
})

function IndexPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['homes'],
    queryFn: () => api.getHomes(),
  })

  const createHomeMutation = useMutation({
    mutationFn: (homeName: string) => api.createHome(homeName),
    onSuccess: (newHome) => {
      queryClient.invalidateQueries({ queryKey: ['homes'] })
      navigate({ to: '/$homeId', params: { homeId: newHome.id } })
    },
  })

  // If homes already exist, automatically redirect to the primary home
  useEffect(() => {
    if (data?.homes && data.homes.length > 0) {
      const firstHome = data.homes[0]
      if (firstHome) {
        navigate({ to: '/$homeId', params: { homeId: firstHome.id } })
      }
    }
  }, [data, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Home name cannot be empty')
      return
    }
    setError(null)
    try {
      await createHomeMutation.mutateAsync(trimmed)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create home'
      setError(message)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-8 transition-colors duration-200">
        <div className="max-w-4xl mx-auto">
          <DashboardSkeleton />
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 flex items-center justify-center p-4 overflow-hidden transition-colors duration-200">
      {/* Decorative ambient background glows */}
      <div
        className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-indigo-500/10 dark:bg-indigo-600/20 blur-[128px]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-violet-500/10 dark:bg-violet-600/20 blur-[128px]"
        aria-hidden="true"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative max-w-md w-full rounded-3xl border border-slate-200/90 bg-white/90 dark:border-slate-800/80 dark:bg-slate-900/80 backdrop-blur-2xl p-8 sm:p-10 shadow-xl dark:shadow-2xl text-center space-y-7 ring-1 ring-slate-900/5 dark:ring-white/10"
      >
        {/* Pulsing floating badge */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', damping: 15, delay: 0.15 }}
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-violet-600 text-white shadow-xl shadow-indigo-500/30 ring-1 ring-white/20"
        >
          <motion.div
            animate={{ rotate: [0, -5, 5, 0] }}
            transition={{ repeat: Number.POSITIVE_INFINITY, duration: 4, ease: 'easeInOut' }}
          >
            <Wallet className="h-8 w-8" aria-hidden="true" />
          </motion.div>
        </motion.div>

        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20 mb-3">
            <Sparkles className="h-3 w-3" /> Zero-drift Fair Bill Splitting
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-slate-950 via-slate-800 to-slate-700 dark:from-white dark:via-slate-100 dark:to-slate-300 bg-clip-text text-transparent">
            Welcome to SplitZero
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Frictionless bill splitting and expense ledger for shared homes and roommates.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0, y: -10 }}
                animate={{ opacity: 1, height: 'auto', y: 0 }}
                exit={{ opacity: 0, height: 0, y: -10 }}
                role="alert"
                className="rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400 font-medium"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <div>
            <label
              htmlFor="home-name-input"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2"
            >
              Name your shared home
            </label>
            <div className="relative group">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition">
                <HomeIcon className="h-4 w-4" aria-hidden="true" />
              </span>
              <input
                id="home-name-input"
                type="text"
                required
                maxLength={100}
                placeholder="e.g. Baker Street Flat, Sunnyvale 204"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50/80 text-slate-900 placeholder-slate-400 dark:border-slate-700/80 dark:bg-slate-950/70 dark:text-slate-100 dark:placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 transition shadow-inner"
              />
            </div>
          </div>

          <motion.button
            type="submit"
            whileHover={{
              scale: 1.02,
              y: -1,
              boxShadow: '0 12px 24px -6px rgba(99, 102, 241, 0.4)',
            }}
            whileTap={{ scale: 0.98 }}
            disabled={createHomeMutation.isPending}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 transition disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
          >
            {createHomeMutation.isPending ? (
              <span className="inline-flex items-center gap-2">Creating Household...</span>
            ) : (
              <>
                <span>Get Started</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </motion.button>
        </form>
      </motion.div>
    </div>
  )
}
