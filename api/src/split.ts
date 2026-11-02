/**
 * Pure bill splitting algorithm.
 *
 * Rules:
 * 1. A bill is split between all members of the home.
 * 2. All shares must be integers (whole cents).
 * 3. The shares must always add up exactly to totalCents.
 * 4. Base share = floor(totalCents / n).
 * 5. Remainder = totalCents % n.
 * 6. The first `remainder` members (in their join order) receive base + 1 cent.
 *    The remaining members receive base cents.
 */
export function splitBill(totalCents: number, memberCount: number): number[] {
  if (!Number.isSafeInteger(totalCents) || totalCents <= 0) {
    throw new RangeError(`totalCents must be a positive safe integer, got ${totalCents}`)
  }
  if (!Number.isSafeInteger(memberCount) || memberCount <= 0) {
    throw new RangeError(`memberCount must be a positive integer, got ${memberCount}`)
  }

  const base = Math.floor(totalCents / memberCount)
  const remainder = totalCents % memberCount

  const shares: number[] = new Array<number>(memberCount)
  for (let i = 0; i < memberCount; i++) {
    shares[i] = i < remainder ? base + 1 : base
  }

  return shares
}
