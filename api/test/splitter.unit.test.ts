import { describe, expect, it } from 'vitest'
import { splitBill } from '../src/domain/splitter'

describe('splitBill pure function', () => {
  it('splits evenly divisible amounts exactly', () => {
    const shares = splitBill(3000, ['m1', 'm2', 'm3'])
    expect(shares).toEqual([
      { memberId: 'm1', amountCents: 1000 },
      { memberId: 'm2', amountCents: 1000 },
      { memberId: 'm3', amountCents: 1000 },
    ])
    expect(shares.reduce((acc, s) => acc + s.amountCents, 0)).toBe(3000)
  })

  it('allocates remainder cents to the first members in order', () => {
    const shares = splitBill(1000, ['m1', 'm2', 'm3'])
    expect(shares).toEqual([
      { memberId: 'm1', amountCents: 334 },
      { memberId: 'm2', amountCents: 333 },
      { memberId: 'm3', amountCents: 333 },
    ])
    expect(shares.reduce((acc, s) => acc + s.amountCents, 0)).toBe(1000)
  })

  it('allocates entire amount when there is only 1 member', () => {
    const shares = splitBill(4999, ['m1'])
    expect(shares).toEqual([{ memberId: 'm1', amountCents: 4999 }])
  })

  it('handles remainder when total cents is less than member count', () => {
    // 2 cents across 5 members: first 2 members get 1, rest get 0
    const shares = splitBill(2, ['m1', 'm2', 'm3', 'm4', 'm5'])
    expect(shares).toEqual([
      { memberId: 'm1', amountCents: 1 },
      { memberId: 'm2', amountCents: 1 },
      { memberId: 'm3', amountCents: 0 },
      { memberId: 'm4', amountCents: 0 },
      { memberId: 'm5', amountCents: 0 },
    ])
    expect(shares.reduce((acc, s) => acc + s.amountCents, 0)).toBe(2)
  })

  it('throws on zero members', () => {
    expect(() => splitBill(1000, [])).toThrow('Cannot split bill among 0 members')
  })

  it.each([0, -100, 10.5, Number.NaN, Infinity, -Infinity])(
    'throws on invalid totalCents %s',
    (badAmount) => {
      expect(() => splitBill(badAmount, ['m1'])).toThrow(
        'totalCents must be a positive safe integer',
      )
    },
  )
})
