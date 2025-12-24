export interface FetchOptions {
  timeout?: number
  headers?: Record<string, string>
  onProgress?: (loaded: number, total: number) => void
}

export class HttpError extends Error {
  constructor(
    message: string,
    public status?: number,
    public statusText?: string
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

export async function fetchM3U(
  url: string,
  options: FetchOptions = {}
): Promise<string> {
  const {
    timeout = 30000,
    headers = {},
    onProgress
  } = options

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Zenith-TV/1.0',
        ...headers
      }
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new HttpError(
        `HTTP ${response.status}: ${response.statusText}`,
        response.status,
        response.statusText
      )
    }

    const contentLength = response.headers.get('content-length')
    const total = contentLength ? parseInt(contentLength, 10) : 0

    if (!response.body || !onProgress) {
      return await response.text()
    }

    const reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let loaded = 0

    while (true) {
      const { done, value } = await reader.read()

      if (done) break

      chunks.push(value)
      loaded += value.length

      if (onProgress && total) {
        onProgress(loaded, total)
      }
    }

    const blob = new Blob(chunks)
    return await blob.text()
  } catch (error) {
    clearTimeout(timeoutId)

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new HttpError('Request timeout')
      }
      throw new HttpError(error.message)
    }

    throw new HttpError('Unknown error occurred')
  }
}

export async function fetchWithRetry(
  url: string,
  options: FetchOptions & { maxRetries?: number } = {}
): Promise<string> {
  const { maxRetries = 3, ...fetchOptions } = options

  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fetchM3U(url, fetchOptions)
    } catch (error) {
      lastError = error as Error
      console.warn(`[HTTP] Attempt ${attempt}/${maxRetries} failed:`, error)

      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  throw lastError || new HttpError('All retry attempts failed')
}

export function validateM3UURL(url: string): boolean {
  try {
    const parsed = new URL(url)
    return ['http:', 'https:'].includes(parsed.protocol)
  } catch {
    return false
  }
}
