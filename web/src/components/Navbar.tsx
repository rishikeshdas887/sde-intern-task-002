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
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand & Home Switcher */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-md shadow-indigo-500/20">
              <Wallet className="h-5 w-5" aria-hidden="true" />
            </div>
            <span className="font-bold text-lg tracking-tight text-slate-100 hidden sm:inline">
              SplitZero
            </span>
          </div>

          <div className="h-5 w-[1px] bg-slate-800 hidden sm:block" />

          {/* Home Switcher Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsHomeMenuOpen(!isHomeMenuOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-900 text-xs font-medium text-slate-200 transition"
              aria-haspopup="true"
              aria-expanded={isHomeMenuOpen}
            >
              <span className="truncate max-w-[140px] sm:max-w-[200px]">
                {currentHome ? currentHome.name : 'Select Household'}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </button>

            {isHomeMenuOpen && (
              <>
                <button
                  type="button"
                  aria-label="Close household menu"
                  className="fixed inset-0 z-10 cursor-default"
                  onClick={() => setIsHomeMenuOpen(false)}
                />
                <div className="absolute left-0 mt-1.5 w-56 rounded-xl border border-slate-800 bg-slate-900 p-1.5 shadow-xl z-20 text-xs">
                  <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Households
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-0.5">
                    {homes.map((home) => (
                      <button
                        key={home.id}
                        type="button"
                        onClick={() => {
                          onSelectHome(home.id)
                          setIsHomeMenuOpen(false)
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg transition truncate ${
                          home.id === selectedHomeId
                            ? 'bg-indigo-600 text-white font-medium'
                            : 'text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        {home.name}
                      </button>
                    ))}
                  </div>
                  <div className="pt-1.5 mt-1 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setIsHomeMenuOpen(false)
                        onCreateHomeClick()
                      }}
                      className="w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-indigo-400 hover:bg-slate-800 transition font-medium"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Create New Home
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right Actions: Add Member, New Bill, Theme Toggle */}
        <div className="flex items-center gap-2.5">
          {selectedHomeId && (
            <>
              <button
                type="button"
                onClick={onAddMemberClick}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-xs font-medium text-slate-200 transition"
              >
                <Users className="h-3.5 w-3.5 text-slate-400" />
                Add Roommate
              </button>

              <button
                type="button"
                onClick={onNewBillClick}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-medium text-white transition shadow-sm shadow-indigo-600/20"
              >
                <Plus className="h-3.5 w-3.5" />
                New Bill
              </button>
            </>
          )}

          {/* Theme Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="p-2 rounded-lg border border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </header>
  )
}
