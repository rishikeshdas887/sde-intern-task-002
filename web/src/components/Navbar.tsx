import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, Moon, Plus, Sun, Users, Wallet } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { HomeItem } from '../api'

interface Props {
  homes: HomeItem[]
  selectedHomeId: string | null
  onSelectHome: (homeId: string) => void
  onCreateHomeClick: () => void
  onAddMemberClick: () => void
  onNewBillClick: () => void
}

export function Navbar({
  homes,
  selectedHomeId,
  onSelectHome,
  onCreateHomeClick,
  onAddMemberClick,
  onNewBillClick,
}: Props) {
  const [isDark, setIsDark] = useState(true)
  const [isHomeMenuOpen, setIsHomeMenuOpen] = useState(false)

  // Initialize theme
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const shouldBeDark = savedTheme ? savedTheme === 'dark' : prefersDark

    setIsDark(shouldBeDark)
    if (shouldBeDark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [])

  const toggleTheme = () => {
    const nextDark = !isDark
    setIsDark(nextDark)
    if (nextDark) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }

  const currentHome = homes.find((h) => h.id === selectedHomeId)

  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/80 dark:border-slate-800/80 dark:bg-slate-950/80 backdrop-blur-xl shadow-sm dark:shadow-lg dark:shadow-black/20 transition-colors duration-200"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand & Home Switcher */}
        <div className="flex items-center gap-4">
          <motion.div
            className="flex items-center gap-2.5 cursor-pointer"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/25 ring-1 ring-white/20">
              <Wallet className="h-5 w-5" aria-hidden="true" />
            </div>
            <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 dark:from-slate-100 dark:via-slate-200 dark:to-slate-400 bg-clip-text text-transparent hidden sm:inline">
              SplitZero
            </span>
          </motion.div>

          <div className="h-5 w-[1px] bg-slate-200 dark:bg-slate-800 hidden sm:block" />

          {/* Home Switcher Dropdown */}
          <div className="relative">
            <motion.button
              type="button"
              whileHover={{ scale: 1.02, borderColor: 'rgb(99 102 241 / 0.5)' }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setIsHomeMenuOpen(!isHomeMenuOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-100/80 hover:bg-slate-200/80 text-slate-800 dark:border-slate-800 dark:bg-slate-900/70 dark:hover:bg-slate-900 dark:text-slate-200 text-xs font-medium transition shadow-sm"
              aria-haspopup="true"
              aria-expanded={isHomeMenuOpen}
            >
              <span className="truncate max-w-[140px] sm:max-w-[200px]">
                {currentHome ? currentHome.name : 'Select Household'}
              </span>
              <motion.span
                animate={{ rotate: isHomeMenuOpen ? 180 : 0 }}
                transition={{ duration: 0.2 }}
                className="flex items-center"
              >
                <ChevronDown className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
              </motion.span>
            </motion.button>

            <AnimatePresence>
              {isHomeMenuOpen && (
                <>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-10 cursor-default"
                    onClick={() => setIsHomeMenuOpen(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -6 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -6 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                    className="absolute left-0 mt-1.5 w-60 rounded-xl border border-slate-200 bg-white/95 text-slate-800 dark:border-slate-800/90 dark:bg-slate-900/95 dark:text-slate-200 backdrop-blur-xl p-1.5 shadow-2xl z-20 text-xs ring-1 ring-slate-900/5 dark:ring-white/5"
                  >
                    <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Households
                    </div>
                    <div className="max-h-52 overflow-y-auto space-y-1">
                      {homes.map((home) => (
                        <motion.button
                          key={home.id}
                          type="button"
                          whileHover={{ x: 2 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => {
                            onSelectHome(home.id)
                            setIsHomeMenuOpen(false)
                          }}
                          className={`w-full text-left px-2.5 py-1.5 rounded-lg transition truncate ${
                            home.id === selectedHomeId
                              ? 'bg-indigo-600 text-white font-medium shadow-sm'
                              : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/80 dark:hover:text-slate-100'
                          }`}
                        >
                          {home.name}
                        </motion.button>
                      ))}
                    </div>
                    <div className="pt-1.5 mt-1 border-t border-slate-200 dark:border-slate-800/80">
                      <motion.button
                        type="button"
                        whileHover={{ x: 2 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          setIsHomeMenuOpen(false)
                          onCreateHomeClick()
                        }}
                        className="w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300 transition font-medium"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Create New Home
                      </motion.button>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Right Actions: Add Member, New Bill, Theme Toggle */}
        <div className="flex items-center gap-2.5">
          {selectedHomeId && (
            <>
              <motion.button
                type="button"
                whileHover={{ scale: 1.04, y: -1 }}
                whileTap={{ scale: 0.96 }}
                onClick={onAddMemberClick}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-100/80 hover:bg-slate-200/80 text-slate-700 dark:border-slate-800 dark:bg-slate-900/70 dark:hover:bg-slate-800/90 dark:text-slate-200 text-xs font-medium transition shadow-sm hover:border-slate-300 dark:hover:border-slate-700"
              >
                <Users className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                Add Roommate
              </motion.button>

              <motion.button
                type="button"
                whileHover={{
                  scale: 1.04,
                  y: -1,
                  boxShadow: '0 8px 20px -4px rgba(99, 102, 241, 0.4)',
                }}
                whileTap={{ scale: 0.96 }}
                onClick={onNewBillClick}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-xs font-medium text-white transition shadow-sm shadow-indigo-600/30"
              >
                <Plus className="h-3.5 w-3.5" />
                New Bill
              </motion.button>
            </>
          )}

          {/* Theme Toggle Button */}
          <motion.button
            type="button"
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92, rotate: 30 }}
            onClick={toggleTheme}
            aria-label={isDark ? 'Switch to white mode' : 'Switch to dark mode'}
            title={isDark ? 'Switch to white mode' : 'Switch to dark mode'}
            className="p-2 rounded-lg border border-slate-200 bg-slate-100/80 text-slate-600 hover:text-slate-900 hover:bg-slate-200/80 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800/90 transition shadow-sm cursor-pointer"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={isDark ? 'sun' : 'moon'}
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                {isDark ? (
                  <Sun className="h-4 w-4 text-amber-500" />
                ) : (
                  <Moon className="h-4 w-4 text-indigo-600" />
                )}
              </motion.div>
            </AnimatePresence>
          </motion.button>
        </div>
      </div>
    </motion.header>
  )
}
