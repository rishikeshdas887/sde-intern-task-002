import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate, useParams } from '@tanstack/react-router'
import { AnimatePresence, motion } from 'framer-motion'
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
    <div className="relative min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 flex flex-col transition-colors duration-200 selection:bg-indigo-500/30 selection:text-indigo-600 dark:selection:text-indigo-200">
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
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            role="alert"
            aria-live="assertive"
            className="rounded-2xl border border-rose-300 bg-rose-50/80 dark:border-rose-500/30 dark:bg-rose-500/10 p-8 text-center max-w-xl mx-auto shadow-2xl"
          >
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/20 text-rose-500">
              <AlertCircle className="h-6 w-6" aria-hidden="true" />
            </div>
            <h2 className="text-lg font-bold text-rose-600 dark:text-rose-400">
              Failed to load household
            </h2>
            <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">{errorMessage}</p>
            <div className="mt-6 flex justify-center gap-3">
              <motion.button
                type="button"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  refetchHome()
                  refetchBalances()
                  refetchBills()
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500 transition shadow-sm cursor-pointer"
              >
                <RefreshCw className="h-4 w-4" />
                Retry Loading
              </motion.button>
              <motion.button
                type="button"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setIsCreateHomeOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Switch or Create Home
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* 3. Main Loaded View */}
        {!isLoading && !hasError && homeData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="space-y-8"
          >
            {/* Hero Metrics Card */}
            <HomeMetrics balances={balancesData?.balances ?? []} homeName={homeData.name} />

            {/* Empty State: Home has no members */}
            {homeData.members.length === 0 ? (
              <motion.section
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                aria-label="Empty members setup"
                className="rounded-2xl border border-dashed border-slate-300 bg-white/60 dark:border-slate-800/80 dark:bg-slate-900/30 p-12 text-center"
              >
                <motion.div
                  animate={{ y: [0, -5, 0] }}
                  transition={{ repeat: Number.POSITIVE_INFINITY, duration: 3, ease: 'easeInOut' }}
                  className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mb-4 border border-emerald-500/20 shadow-lg shadow-emerald-500/10"
                >
                  <Users className="h-7 w-7" aria-hidden="true" />
                </motion.div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">
                  No roommates added yet
                </h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                  Add household members in the order they moved in to begin splitting shared utility
                  and grocery expenses with zero rounding drift.
                </p>
                <motion.button
                  type="button"
                  whileHover={{
                    scale: 1.04,
                    y: -1,
                    boxShadow: '0 8px 24px -4px rgba(16, 185, 129, 0.4)',
                  }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setIsAddMemberOpen(true)}
                  className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-600/25 transition cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  Add First Roommate
                </motion.button>
              </motion.section>
            ) : (
              /* Bills Section */
              <section aria-labelledby="bills-section-title" className="space-y-5">
                {/* Bills Header & Controls */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200 dark:border-slate-800/80">
                  <div>
                    <h2
                      id="bills-section-title"
                      className="text-lg font-bold text-slate-900 dark:text-slate-100"
                    >
                      Household Bills & Splits
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
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
                        className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white text-slate-900 placeholder-slate-400 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-200 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition shadow-inner"
                      />
                    </div>

                    {/* Filter Segmented Sliding Buttons */}
                    <div className="relative inline-flex rounded-xl border border-slate-300 bg-slate-200/70 dark:border-slate-800/90 dark:bg-slate-900/80 p-1 text-xs shadow-inner">
                      {(['all', 'unpaid', 'settled'] as const).map((status) => {
                        const isActive = filterStatus === status
                        const label =
                          status === 'all' ? 'All' : status === 'unpaid' ? 'Unpaid' : 'Settled'
                        return (
                          <button
                            key={status}
                            type="button"
                            onClick={() => setFilterStatus(status)}
                            className={`relative px-3 py-1 rounded-lg font-semibold transition cursor-pointer ${
                              isActive
                                ? 'text-white'
                                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                            }`}
                          >
                            {isActive && (
                              <motion.div
                                layoutId="activeFilterTab"
                                className="absolute inset-0 rounded-lg bg-indigo-600 shadow-sm"
                                transition={{ type: 'spring', bounce: 0.2, duration: 0.35 }}
                              />
                            )}
                            <span className="relative z-10">{label}</span>
                          </button>
                        )
                      })}
                    </div>

                    <motion.button
                      type="button"
                      whileHover={{
                        scale: 1.04,
                        y: -1,
                        boxShadow: '0 8px 20px -4px rgba(99, 102, 241, 0.4)',
                      }}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => setIsCreateBillOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-xs font-semibold text-white transition shadow-sm shadow-indigo-600/30 cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Split Bill
                    </motion.button>
                  </div>
                </div>

                {/* Empty State: Home has members but no bills */}
                {billsData?.bills && billsData.bills.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="rounded-2xl border border-dashed border-slate-300 bg-white/60 dark:border-slate-800/80 dark:bg-slate-900/30 p-12 text-center"
                  >
                    <motion.div
                      animate={{ y: [0, -5, 0] }}
                      transition={{
                        repeat: Number.POSITIVE_INFINITY,
                        duration: 3,
                        ease: 'easeInOut',
                      }}
                      className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 mb-4 border border-indigo-500/20 shadow-lg shadow-indigo-500/10"
                    >
                      <Receipt className="h-7 w-7" aria-hidden="true" />
                    </motion.div>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">
                      No bills added yet
                    </h3>
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                      All settled up! Add a new expense (e.g. WiFi, electricity, groceries) to split
                      it deterministically across all roommates.
                    </p>
                    <motion.button
                      type="button"
                      whileHover={{
                        scale: 1.04,
                        y: -1,
                        boxShadow: '0 8px 24px -4px rgba(99, 102, 241, 0.4)',
                      }}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => setIsCreateBillOpen(true)}
                      className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 px-5 py-2.5 text-sm font-semibold text-white hover:from-indigo-500 hover:to-indigo-400 transition shadow-md shadow-indigo-600/25 cursor-pointer"
                    >
                      <Plus className="h-4 w-4" />
                      Create First Bill
                    </motion.button>
                  </motion.div>
                ) : filteredBills.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="rounded-2xl border border-slate-200 bg-white/70 text-slate-600 dark:border-slate-800 dark:bg-slate-900/30 p-10 text-center text-sm dark:text-slate-400"
                  >
                    No bills matching filter criteria.
                  </motion.div>
                ) : (
                  /* Animated Bills Grid */
                  <motion.div layout className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <AnimatePresence mode="popLayout">
                      {filteredBills.map((bill) => (
                        <BillCard
                          key={bill.id}
                          bill={bill}
                          members={homeData.members}
                          onPayShare={handlePayShare}
                        />
                      ))}
                    </AnimatePresence>
                  </motion.div>
                )}
              </section>
            )}
          </motion.div>
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
