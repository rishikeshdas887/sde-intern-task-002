/**
 * Pure function to split a total bill amount in integer cents across members.
 * Preserves the exact ordering of memberIds provided.
 *
 * Rules:
 * 1. Base share = floor(totalCents / n)
 * 2. Remainder = totalCents % n
 * 3. The first `remainder` members in the provided order receive base + 1 cent.
 * 4. Invariant: Sum of all shares must strictly equal totalCents.
 */
export interface SplitShare {
  memberId: string
  amountCents: number
}

export function splitBill(totalCents: number, memberIds: readonly string[]): SplitShare[] {
  const n = memberIds.length
  if (n === 0) {
    throw new Error('Cannot split bill among 0 members')
  }

  if (!Number.isSafeInteger(totalCents) || totalCents <= 0) {
    throw new Error('totalCents must be a positive safe integer')
  }

  const base = Math.floor(totalCents / n)
  const remainder = totalCents % n

  return memberIds.map((memberId, index) => ({
    memberId,
    amountCents: index < remainder ? base + 1 : base,
  }))
}
