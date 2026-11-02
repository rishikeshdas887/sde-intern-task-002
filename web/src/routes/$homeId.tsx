import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate, useParams } from '@tanstack/react-router'
import { AlertCircle, Plus, Receipt, RefreshCw, Search, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { api } from '../api'
import { AddMemberModal } from '../components/AddMemberModal'
import { BillCard } from '../components/BillCard'
import { CreateBillModal } from '../components/CreateBillModal'
import { CreateHomeModal } from '../components/CreateHomeModal'
import { HomeMetrics } from '../components/HomeMetrics'
import { Navbar } from '../components/Navbar'
import { DashboardSkeleton } from '../components/Skeletons'

export const Route = createFileRoute('/$homeId')({
  component: HomeDashboard,
})

function HomeDashboard() {
  const { homeId } = useParams({ from: '/$homeId' })
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Modals state
  const [isCreateHomeOpen, setIsCreateHomeOpen] = useState(false)
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false)
  const [isCreateBillOpen, setIsCreateBillOpen] = useState(false)

  // Filter state
  const [filterStatus, setFilterStatus] = useState<'all' | 'unpaid' | 'settled'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // 1. Fetch all homes for switcher
  const { data: homesData } = useQuery({
    queryKey: ['homes'],
    queryFn: () => api.getHomes(),
  })

  // 2. Fetch current home details & members
  const {
    data: homeData,
    isLoading: isHomeLoading,
    error: homeError,
    refetch: refetchHome,
  } = useQuery({
    queryKey: ['home', homeId],
    queryFn: () => api.getHome(homeId),
    retry: 1,
  })

  // 3. Fetch balances for home
  const {
    data: balancesData,
    isLoading: isBalancesLoading,
    error: balancesError,
    refetch: refetchBalances,
  } = useQuery({
    queryKey: ['balances', homeId],
    queryFn: () => api.getBalances(homeId),
    enabled: Boolean(homeData),
    retry: 1,
  })

  // 4. Fetch bills with shares for home
  const {
    data: billsData,
    isLoading: isBillsLoading,
    error: billsError,
    refetch: refetchBills,
  } = useQuery({
    queryKey: ['bills', homeId],
    queryFn: () => api.getBills(homeId),
    enabled: Boolean(homeData),
    retry: 1,
  })

  // Mutations
  const createHomeMutation = useMutation({
    mutationFn: (name: string) => api.createHome(name),
    onSuccess: (newHome) => {
      queryClient.invalidateQueries({ queryKey: ['homes'] })
      navigate({ to: '/$homeId', params: { homeId: newHome.id } })
    },
  })

  const addMemberMutation = useMutation({
    mutationFn: (name: string) => api.addMember(homeId, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['home', homeId] })
      queryClient.invalidateQueries({ queryKey: ['balances', homeId] })
    },
  })

  const createBillMutation = useMutation({
    mutationFn: ({ title, totalCents }: { title: string; totalCents: number }) =>
      api.createBill(homeId, title, totalCents),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bills', homeId] })
      queryClient.invalidateQueries({ queryKey: ['balances', homeId] })
    },
  })

  const payShareMutation = useMutation({
    mutationFn: ({
      billId,
      shareId,
      idempotencyKey,
    }: {
      billId: string
      shareId: string
      idempotencyKey: string
    }) => api.payShare(billId, shareId, idempotencyKey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bills', homeId] })
      queryClient.invalidateQueries({ queryKey: ['balances', homeId] })
    },
  })

  const handlePayShare = async (billId: string, shareId: string, idempotencyKey: string) => {
    await payShareMutation.mutateAsync({ billId, shareId, idempotencyKey })
  }

  const handleSelectHome = (nextHomeId: string) => {
    navigate({ to: '/$homeId', params: { homeId: nextHomeId } })
  }

  // Filtered bills
  const filteredBills = useMemo(() => {
    if (!billsData?.bills) return []
    return billsData.bills.filter((bill) => {
      // Status filter
      const totalShares = bill.shares.length
      const paidShares = bill.shares.filter((s) => s.paidAt !== null).length
      const isSettled = paidShares === totalShares && totalShares > 0

      if (filterStatus === 'unpaid' && isSettled) return false
      if (filterStatus === 'settled' && !isSettled) return false

      // Search filter
      if (searchQuery.trim().length > 0) {
        const query = searchQuery.toLowerCase()
        const matchesTitle = bill.title.toLowerCase().includes(query)
        const matchesMember = bill.shares.some((s) => s.memberName?.toLowerCase().includes(query))
        return matchesTitle || matchesMember
      }

      return true
    })
  }, [billsData?.bills, filterStatus, searchQuery])

  const isLoading = isHomeLoading || isBalancesLoading || isBillsLoading
  const hasError = homeError || balancesError || billsError
  const errorMessage =
    homeError instanceof Error
      ? homeError.message
      : balancesError instanceof Error
        ? balancesError.message
        : billsError instanceof Error
          ? billsError.message
          : 'Unable to load household data'

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Persistent Navigation Bar */}
      <Navbar
        homes={homesData?.homes ?? []}
        selectedHomeId={homeId}
        onSelectHome={handleSelectHome}
        onCreateHomeClick={() => setIsCreateHomeOpen(true)}
        onAddMemberClick={() => setIsAddMemberOpen(true)}
        onNewBillClick={() => setIsCreateBillOpen(true)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* 1. Loading State */}
        {isLoading && <DashboardSkeleton />}

        {/* 2. Error State */}
        {!isLoading && hasError && (
          <div
            role="alert"
            aria-live="assertive"
            className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-8 text-center max-w-xl mx-auto shadow-lg"
          >
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/20 text-rose-500">
              <AlertCircle className="h-6 w-6" aria-hidden="true" />
            </div>
            <h2 className="text-lg font-semibold text-rose-400">Failed to load household</h2>
            <p className="mt-2 text-sm text-slate-300">{errorMessage}</p>
            <div className="mt-6 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  refetchHome()
                  refetchBalances()
                  refetchBills()
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 transition shadow-sm"
              >
                <RefreshCw className="h-4 w-4" />
                Retry Loading
              </button>
              <button
                type="button"
                onClick={() => setIsCreateHomeOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 transition"
              >
                Switch or Create Home
              </button>
            </div>
          </div>
        )}

        {/* 3. Main Loaded View */}
        {!isLoading && !hasError && homeData && (
          <>
            {/* Hero Metrics Card */}
            <HomeMetrics balances={balancesData?.balances ?? []} homeName={homeData.name} />

            {/* Empty State: Home has no members */}
            {homeData.members.length === 0 ? (
              <section
                aria-label="Empty members setup"
                className="rounded-xl border border-dashed border-slate-800 bg-slate-900/30 p-12 text-center"
              >
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 mb-4">
                  <Users className="h-6 w-6" aria-hidden="true" />
                </div>
                <h3 className="text-base font-semibold text-slate-200">No roommates added yet</h3>
                <p className="mt-1.5 text-sm text-slate-400 max-w-sm mx-auto">
                  Add household members in the order they moved in to begin splitting shared utility
                  and grocery expenses.
                </p>
                <button
                  type="button"
                  onClick={() => setIsAddMemberOpen(true)}
                  className="mt-6 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition shadow-sm shadow-emerald-600/20"
                >
                  <Plus className="h-4 w-4" />
                  Add First Roommate
                </button>
              </section>
            ) : (
              /* Bills Section */
              <section aria-labelledby="bills-section-title" className="space-y-4">
                {/* Bills Header & Controls */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
                  <div>
                    <h2 id="bills-section-title" className="text-lg font-semibold text-slate-100">
                      Household Bills & Splits
                    </h2>
                    <p className="text-xs text-slate-400">
                      Track utility bills, groceries, and individual member shares
                    </p>
                  </div>

                  <div className="flex items-center gap-3 flex-wrap">
                    {/* Search bar */}
                    <div className="relative min-w-[200px]">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                      <input
                        type="search"
                        placeholder="Filter bills..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-800 bg-slate-900/60 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    {/* Filter Segmented Buttons */}
                    <div className="inline-flex rounded-lg border border-slate-800 bg-slate-900/60 p-0.5 text-xs">
                      <button
                        type="button"
                        onClick={() => setFilterStatus('all')}
                        className={`px-3 py-1 rounded-md font-medium transition ${
                          filterStatus === 'all'
                            ? 'bg-indigo-600 text-white'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        All
                      </button>
                      <button
                        type="button"
                        onClick={() => setFilterStatus('unpaid')}
                        className={`px-3 py-1 rounded-md font-medium transition ${
                          filterStatus === 'unpaid'
                            ? 'bg-indigo-600 text-white'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Unpaid
                      </button>
                      <button
                        type="button"
                        onClick={() => setFilterStatus('settled')}
                        className={`px-3 py-1 rounded-md font-medium transition ${
                          filterStatus === 'settled'
                            ? 'bg-indigo-600 text-white'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Settled
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsCreateBillOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-medium text-white transition shadow-sm shadow-indigo-600/20"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Split Bill
                    </button>
                  </div>
                </div>

                {/* Empty State: Home has members but no bills */}
                {billsData?.bills && billsData.bills.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900/30 p-12 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-400 mb-4">
                      <Receipt className="h-6 w-6" aria-hidden="true" />
                    </div>
                    <h3 className="text-base font-semibold text-slate-200">No bills added yet</h3>
                    <p className="mt-1.5 text-sm text-slate-400 max-w-sm mx-auto">
                      All settled up! Add a new expense (e.g. WiFi, electricity, groceries) to split
                      it automatically.
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsCreateBillOpen(true)}
                      className="mt-6 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition shadow-sm"
                    >
                      <Plus className="h-4 w-4" />
                      Create First Bill
                    </button>
                  </div>
                ) : filteredBills.length === 0 ? (
                  <div className="rounded-xl border border-slate-800 bg-slate-900/20 p-8 text-center text-sm text-slate-400">
                    No bills matching filter criteria.
                  </div>
                ) : (
                  /* Bills Grid */
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredBills.map((bill) => (
                      <BillCard
                        key={bill.id}
                        bill={bill}
                        members={homeData.members}
                        onPayShare={handlePayShare}
                      />
                    ))}
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </main>

      {/* Modals */}
      <CreateHomeModal
        isOpen={isCreateHomeOpen}
        onClose={() => setIsCreateHomeOpen(false)}
        onSubmit={async (name) => {
          await createHomeMutation.mutateAsync(name)
        }}
        isSubmitting={createHomeMutation.isPending}
      />

      <AddMemberModal
        isOpen={isAddMemberOpen}
        onClose={() => setIsAddMemberOpen(false)}
        onSubmit={async (name) => {
          await addMemberMutation.mutateAsync(name)
        }}
        isSubmitting={addMemberMutation.isPending}
        homeName={homeData?.name ?? 'Household'}
      />

      <CreateBillModal
        isOpen={isCreateBillOpen}
        onClose={() => setIsCreateBillOpen(false)}
        onSubmit={async (title, totalCents) => {
          await createBillMutation.mutateAsync({ title, totalCents })
        }}
        isSubmitting={createBillMutation.isPending}
        members={homeData?.members ?? []}
      />
    </div>
  )
}
