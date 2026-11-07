export interface MemberItem {
  id: string
  homeId: string
  name: string
  position: number
}

export interface HomeItem {
  id: string
  name: string
  createdAt?: string
  memberCount?: number
}

export interface HomeDetails {
  id: string
  name: string
  createdAt?: string
  members: MemberItem[]
}

export interface ShareItem {
  id: string
  billId?: string
  memberId: string
  memberName?: string
  amountCents: number
  paidAt: string | null
}

export interface BillWithShares {
  id: string
  homeId: string
  title: string
  totalCents: number
  createdAt?: string
  shares: ShareItem[]
}

export interface MemberBalance {
  memberId: string
  name: string
  outstandingCents: number
}

export class ApiClientError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiClientError'
    this.status = status
  }
}

const DEFAULT_TIMEOUT_MS = 12000
const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') || ''

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function request<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST'
    body?: unknown
    headers?: Record<string, string>
    signal?: AbortSignal
    timeoutMs?: number
    retries?: number
  } = {},
): Promise<T> {
  const maxRetries = options.retries ?? (options.method === 'POST' ? 1 : 2)
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS

  let lastError: unknown

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    const onAbort = () => controller.abort()
    if (options.signal) {
      options.signal.addEventListener('abort', onAbort)
    }

    const url =
      path.startsWith('http://') || path.startsWith('https://')
        ? path
        : `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`

    try {
      const response = await fetch(url, {
        method: options.method ?? 'GET',
        headers: {
          'content-type': 'application/json',
          ...options.headers,
        },
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      })

      const text = await response.text()
      let data: unknown
      try {
        data = text.length > 0 ? JSON.parse(text) : null
      } catch {
        throw new ApiClientError(
          `Server returned invalid response (${response.status})`,
          response.status,
        )
      }

      if (!response.ok) {
        const errorMessage =
          typeof data === 'object' &&
          data !== null &&
          'error' in data &&
          typeof (data as { error: unknown }).error === 'string'
            ? (data as { error: string }).error
            : `Request failed with status ${response.status}`
        throw new ApiClientError(errorMessage, response.status)
      }

      return data as T
    } catch (err: unknown) {
      lastError = err

      // If caller intentionally aborted, don't retry
      if (options.signal?.aborted) {
        throw new ApiClientError('Request was cancelled', 499)
      }

      const isTimeout =
        (err instanceof DOMException && err.name === 'AbortError') ||
        (err instanceof ApiClientError && (err.status === 408 || err.status === 504))

      const isServerUnavailable =
        err instanceof ApiClientError && (err.status === 502 || err.status === 503)

      // Retry on network timeout or cold start server unavailable
      if (
        attempt < maxRetries &&
        (isTimeout || isServerUnavailable || !(err instanceof ApiClientError))
      ) {
        await wait(500 * (attempt + 1))
        continue
      }

      if (err instanceof ApiClientError) {
        throw err
      }

      if (isTimeout) {
        throw new ApiClientError(
          'Server took too long to respond. Please check your connection and retry.',
          408,
        )
      }

      const message = err instanceof Error ? err.message : 'Network request failed'
      throw new ApiClientError(message, 0)
    } finally {
      clearTimeout(timeoutId)
      if (options.signal) {
        options.signal.removeEventListener('abort', onAbort)
      }
    }
  }

  throw lastError instanceof ApiClientError
    ? lastError
    : new ApiClientError('Request failed after retries', 0)
}

export const api = {
  getHomes: () => request<{ homes: HomeItem[] }>('/api/homes'),

  getHome: (homeId: string) => request<HomeDetails>(`/api/homes/${homeId}`),

  createHome: (name: string) =>
    request<{ id: string; name: string }>('/api/homes', {
      method: 'POST',
      body: { name },
    }),

  addMember: (homeId: string, name: string) =>
    request<MemberItem>(`/api/homes/${homeId}/members`, {
      method: 'POST',
      body: { name },
    }),

  getBalances: (homeId: string) =>
    request<{ balances: MemberBalance[] }>(`/api/homes/${homeId}/balances`),

  getBills: (homeId: string) => request<{ bills: BillWithShares[] }>(`/api/homes/${homeId}/bills`),

  createBill: (homeId: string, title: string, totalCents: number) =>
    request<BillWithShares>(`/api/homes/${homeId}/bills`, {
      method: 'POST',
      body: { title, totalCents },
    }),

  payShare: (billId: string, shareId: string, idempotencyKey: string) =>
    request<ShareItem>(`/api/bills/${billId}/shares/${shareId}/pay`, {
      method: 'POST',
      headers: {
        'Idempotency-Key': idempotencyKey,
      },
    }),
}
