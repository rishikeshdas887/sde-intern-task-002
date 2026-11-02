import { exports } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'
import { type Balance, call, createBill, createHome, type Member, type Share } from './helpers'

describe('Hardening & Concurrency Tests', () => {
  describe('Case 1: Home with no members', () => {
    it('returns 422 when creating a bill for a home without members', async () => {
      const home = await call<{ id: string }>('POST', '/api/homes', {
        body: { name: 'Empty Home' },
      })
      expect(home.status).toBe(201)

      const res = await call<{ error: string }>('POST', `/api/homes/${home.body.id}/bills`, {
        body: { title: 'Internet', totalCents: 5000 },
      })
      expect(res.status).toBe(422)
      expect(res.body.error).toBe('Home has no members')
    })
  })

  describe('Case 2: Amount validation (zero, negative, non-integer, unsafe)', () => {
    it('rejects 0 cents with 422', async () => {
      const { homeId } = await createHome(['Alice'])
      const res = await call<{ error: string }>('POST', `/api/homes/${homeId}/bills`, {
        body: { title: 'Zero Bill', totalCents: 0 },
      })
      expect(res.status).toBe(422)
      expect(res.body.error).toBe('totalCents must be a positive safe integer under 1,000,000,000')
    })

    it('rejects negative cents with 422', async () => {
      const { homeId } = await createHome(['Alice'])
      const res = await call<{ error: string }>('POST', `/api/homes/${homeId}/bills`, {
        body: { title: 'Negative Bill', totalCents: -500 },
      })
      expect(res.status).toBe(422)
      expect(res.body.error).toBe('totalCents must be a positive safe integer under 1,000,000,000')
    })

    it('rejects non-integer float cents with 422', async () => {
      const { homeId } = await createHome(['Alice'])
      const res = await call<{ error: string }>('POST', `/api/homes/${homeId}/bills`, {
        body: { title: 'Float Bill', totalCents: 12.34 },
      })
      expect(res.status).toBe(422)
      expect(res.body.error).toBe('totalCents must be a positive safe integer under 1,000,000,000')
    })

    it('rejects string amount with 422', async () => {
      const { homeId } = await createHome(['Alice'])
      const res = await call<{ error: string }>('POST', `/api/homes/${homeId}/bills`, {
        body: { title: 'String Bill', totalCents: '1000' },
      })
      expect(res.status).toBe(422)
      expect(res.body.error).toBe('totalCents must be a positive safe integer under 1,000,000,000')
    })

    it('rejects huge amount exceeding safety threshold with 422', async () => {
      const { homeId } = await createHome(['Alice'])
      const res = await call<{ error: string }>('POST', `/api/homes/${homeId}/bills`, {
        body: { title: 'Too Big Bill', totalCents: 2_000_000_000 },
      })
      expect(res.status).toBe(422)
      expect(res.body.error).toBe('totalCents must be a positive safe integer under 1,000,000,000')
    })
  })

  describe('Case 3: Uneven split exact sum invariant', () => {
    it('splits 1000 cents across 3 members with exact remainder distribution', async () => {
      const { homeId, members } = await createHome(['Asha', 'Ben', 'Chloe'])
      const bill = await createBill(homeId, 1000)

      expect(bill.status).toBe(201)
      expect(bill.body.shares).toHaveLength(3)

      // Remainder 1000 % 3 = 1 -> First member gets base + 1 = 334, others get 333
      expect(bill.body.shares[0]?.memberId).toBe(members[0]?.id)
      expect(bill.body.shares[0]?.amountCents).toBe(334)

      expect(bill.body.shares[1]?.memberId).toBe(members[1]?.id)
      expect(bill.body.shares[1]?.amountCents).toBe(333)

      expect(bill.body.shares[2]?.memberId).toBe(members[2]?.id)
      expect(bill.body.shares[2]?.amountCents).toBe(333)

      const totalShares = bill.body.shares.reduce((acc, s) => acc + s.amountCents, 0)
      expect(totalShares).toBe(1000)
    })

    it('splits 100 cents across 6 members cleanly (17, 17, 17, 17, 16, 16)', async () => {
      const { homeId } = await createHome(['M1', 'M2', 'M3', 'M4', 'M5', 'M6'])
      const bill = await createBill(homeId, 100)

      expect(bill.status).toBe(201)
      const amounts = bill.body.shares.map((s) => s.amountCents)
      expect(amounts).toEqual([17, 17, 17, 17, 16, 16])
      expect(amounts.reduce((a, b) => a + b, 0)).toBe(100)
    })
  })

  describe('Case 4: Idempotency replay semantics', () => {
    it('returns exact same response body and timestamp on replaying key', async () => {
      const { homeId } = await createHome(['Devon', 'Elena'])
      const bill = await createBill(homeId, 2000)
      const share = bill.body.shares[0]
      if (!share) throw new Error('Missing share')
      const key = crypto.randomUUID()

      const res1 = await call<Share>('POST', `/api/bills/${bill.body.id}/shares/${share.id}/pay`, {
        headers: { 'Idempotency-Key': key },
      })
      expect(res1.status).toBe(200)

      const res2 = await call<Share>('POST', `/api/bills/${bill.body.id}/shares/${share.id}/pay`, {
        headers: { 'Idempotency-Key': key },
      })
      expect(res2.status).toBe(200)
      expect(res2.body.id).toBe(res1.body.id)
      expect(res2.body.paidAt).toBe(res1.body.paidAt)
      expect(res2.body.amountCents).toBe(res1.body.amountCents)

      // Confirm only 1 share is marked paid in balances
      const bal = await call<{ balances: Balance[] }>('GET', `/api/homes/${homeId}/balances`)
      expect(bal.body.balances.map((b) => b.outstandingCents)).toEqual([0, 1000])
    })
  })

  describe('Case 5: Concurrency race condition on same share', () => {
    it('serializes parallel payments with different keys: exactly one 200 and one 409', async () => {
      const { homeId } = await createHome(['Fiona', 'George'])
      const bill = await createBill(homeId, 1500)
      const share = bill.body.shares[0]
      if (!share) throw new Error('Missing share')

      const keyA = crypto.randomUUID()
      const keyB = crypto.randomUUID()

      const [resA, resB] = await Promise.all([
        call<Share>('POST', `/api/bills/${bill.body.id}/shares/${share.id}/pay`, {
          headers: { 'Idempotency-Key': keyA },
        }),
        call<Share>('POST', `/api/bills/${bill.body.id}/shares/${share.id}/pay`, {
          headers: { 'Idempotency-Key': keyB },
        }),
      ])

      const statuses = [resA.status, resB.status].sort()
      expect(statuses).toEqual([200, 409])
    })
  })

  describe('Case 6: Nonexistent resources and cross-resource mismatch (404)', () => {
    it('returns 404 for member creation on nonexistent home', async () => {
      const res = await call<{ error: string }>('POST', '/api/homes/non-existent-home-id/members', {
        body: { name: 'Ghost' },
      })
      expect(res.status).toBe(404)
      expect(res.body.error).toBe('Home not found')
    })

    it('returns 404 for bill creation on nonexistent home', async () => {
      const res = await call<{ error: string }>('POST', '/api/homes/non-existent-home-id/bills', {
        body: { title: 'Ghost Bill', totalCents: 1000 },
      })
      expect(res.status).toBe(404)
      expect(res.body.error).toBe('Home not found')
    })

    it('returns 404 when share belongs to a different bill (cross-resource mismatch)', async () => {
      const { homeId } = await createHome(['Hannah'])
      const bill1 = await createBill(homeId, 1000)
      const bill2 = await createBill(homeId, 2000)
      const shareFromBill2 = bill2.body.shares[0]
      if (!shareFromBill2) throw new Error('Missing share')

      // Attempt to pay shareFromBill2 against bill1
      const res = await call<{ error: string }>(
        'POST',
        `/api/bills/${bill1.body.id}/shares/${shareFromBill2.id}/pay`,
        {
          headers: { 'Idempotency-Key': crypto.randomUUID() },
        },
      )
      expect(res.status).toBe(404)
      expect(res.body.error).toBe('Share not found')
    })
  })

  describe('Case 7: Malformed body & whitespace strings (400)', () => {
    it('returns 400 for malformed JSON syntax', async () => {
      const res = await exports.default.fetch(
        new Request('http://localhost/api/homes', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{ invalid json ',
        }),
      )
      expect(res.status).toBe(400)
      const body = (await res.json()) as { error: string }
      expect(body.error).toBe('Malformed JSON body')
    })

    it('returns 400 for whitespace-only home name', async () => {
      const res = await call<{ error: string }>('POST', '/api/homes', {
        body: { name: '   ' },
      })
      expect(res.status).toBe(400)
      expect(res.body.error).toBe('Name must be between 1 and 200 characters')
    })

    it('returns 400 for whitespace-only member name', async () => {
      const home = await call<{ id: string }>('POST', '/api/homes', {
        body: { name: 'Valid Home' },
      })
      const res = await call<{ error: string }>('POST', `/api/homes/${home.body.id}/members`, {
        body: { name: '   \t\n  ' },
      })
      expect(res.status).toBe(400)
      expect(res.body.error).toBe('Name must be between 1 and 200 characters')
    })

    it('returns 400 for whitespace-only bill title', async () => {
      const { homeId } = await createHome(['Ian'])
      const res = await call<{ error: string }>('POST', `/api/homes/${homeId}/bills`, {
        body: { title: '   ', totalCents: 1000 },
      })
      expect(res.status).toBe(400)
      expect(res.body.error).toBe('Title must be a non-empty string under 200 characters')
    })
  })

  describe('Case 8: Advanced domain edge cases & robustness', () => {
    it('handles totalCents less than member count (0-cent shares saved and payable)', async () => {
      const { homeId } = await createHome(['M1', 'M2', 'M3', 'M4', 'M5'])
      const bill = await createBill(homeId, 2)

      expect(bill.status).toBe(201)
      expect(bill.body.shares).toHaveLength(5)
      expect(bill.body.shares.map((s) => s.amountCents)).toEqual([1, 1, 0, 0, 0])

      // Paying a 0-cent share works cleanly
      const zeroShare = bill.body.shares[2]
      if (!zeroShare) throw new Error('Missing share')
      const paid = await call<Share>(
        'POST',
        `/api/bills/${bill.body.id}/shares/${zeroShare.id}/pay`,
        {
          headers: { 'Idempotency-Key': crypto.randomUUID() },
        },
      )
      expect(paid.status).toBe(200)
      expect(paid.body.paidAt).toEqual(expect.any(String))
    })

    it('allows duplicate member names in the same home while maintaining sequence ordering', async () => {
      const home = await call<{ id: string }>('POST', '/api/homes', {
        body: { name: 'Duplicate Roommates Flat' },
      })
      const m1 = await call<Member>('POST', `/api/homes/${home.body.id}/members`, {
        body: { name: 'Alex' },
      })
      const m2 = await call<Member>('POST', `/api/homes/${home.body.id}/members`, {
        body: { name: 'Alex' },
      })

      expect(m1.status).toBe(201)
      expect(m2.status).toBe(201)
      expect(m1.body.id).not.toBe(m2.body.id)

      const balancesRes = await call<{ balances: Balance[] }>(
        'GET',
        `/api/homes/${home.body.id}/balances`,
      )
      expect(balancesRes.status).toBe(200)
      expect(balancesRes.body.balances.map((b) => b.memberId)).toEqual([m1.body.id, m2.body.id])
    })

    it('supports Unicode and international character strings', async () => {
      const home = await call<{ id: string; name: string }>('POST', '/api/homes', {
        body: { name: '🏡 Casa de Montaña 🏔️ (東京都)' },
      })
      expect(home.status).toBe(201)
      expect(home.body.name).toBe('🏡 Casa de Montaña 🏔️ (東京都)')

      const member = await call<Member>('POST', `/api/homes/${home.body.id}/members`, {
        body: { name: '田中 太郎 (René)' },
      })
      expect(member.status).toBe(201)
      expect(member.body.name).toBe('田中 太郎 (René)')
    })
  })
})
