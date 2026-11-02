import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Home as HomeIcon, Plus, Wallet } from 'lucide-react'
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
      <div className="min-h-screen bg-slate-950 p-8">
        <div className="max-w-4xl mx-auto">
          <DashboardSkeleton />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl text-center space-y-6">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-lg shadow-indigo-500/20">
          <Wallet className="h-7 w-7" aria-hidden="true" />
        </div>

        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">Welcome to SplitZero</h1>
          <p className="mt-2 text-sm text-slate-400">
            Frictionless bill splitting and expense ledger for shared homes and roommates.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          {error && (
            <div
              role="alert"
              className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400"
            >
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="home-name-input"
              className="block text-xs font-medium text-slate-300 mb-1.5"
            >
              Name your shared home
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-500">
                <HomeIcon className="h-4 w-4" />
              </span>
              <input
                id="home-name-input"
                type="text"
                required
                maxLength={100}
                placeholder="e.g. Flat 4B, 221B Baker St"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={createHomeMutation.isPending || !name.trim()}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 transition shadow-sm shadow-indigo-600/30 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {createHomeMutation.isPending ? 'Setting up...' : 'Create Household'}
          </button>
        </form>
      </div>
    </div>
  )
}
