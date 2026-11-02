const USD_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/**
 * Formats whole cents into USD currency string.
 * Example: 1000 cents -> "$10.00"
 */
export function formatCents(cents: number): string {
  const dollars = cents / 100
  return USD_FORMATTER.format(dollars)
}

export interface AvatarPalette {
  bg: string
  text: string
  border: string
}

const DEFAULT_PALETTE: AvatarPalette = {
  bg: 'bg-indigo-500/15',
  text: 'text-indigo-400',
  border: 'border-indigo-500/30',
}

const AVATAR_PALETTES: readonly AvatarPalette[] = [
  { bg: 'bg-indigo-500/15', text: 'text-indigo-400', border: 'border-indigo-500/30' },
  { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
  { bg: 'bg-rose-500/15', text: 'text-rose-400', border: 'border-rose-500/30' },
  { bg: 'bg-cyan-500/15', text: 'text-cyan-400', border: 'border-cyan-500/30' },
  { bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/30' },
  { bg: 'bg-teal-500/15', text: 'text-teal-400', border: 'border-teal-500/30' },
  { bg: 'bg-sky-500/15', text: 'text-sky-400', border: 'border-sky-500/30' },
]

/**
 * Returns deterministic initials and styling for a user name.
 */
export function getAvatarInfo(name: string): { initials: string; palette: AvatarPalette } {
  const trimmed = name.trim()
  const initials =
    trimmed
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word.charAt(0).toUpperCase())
      .join('') || '?'

  let hash = 0
  for (let i = 0; i < trimmed.length; i++) {
    hash = (hash << 5) - hash + trimmed.charCodeAt(i)
    hash |= 0
  }
  const index = Math.abs(hash) % AVATAR_PALETTES.length
  const palette: AvatarPalette = AVATAR_PALETTES[index] ?? DEFAULT_PALETTE

  return {
    initials,
    palette,
  }
}
