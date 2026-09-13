import * as https from 'https'
import {
  AddressTransactionsPage,
  BlockReference,
  BlockchainClient,
  RawBlock,
  RawTransaction,
} from './bitcoin-service'

export type JsonRequester = (url: string) => Promise<unknown>
export type Sleep = (ms: number) => Promise<void>

type HttpError = Error & { status?: number }

const BLOCK_CACHE_LIMIT = 128
const DAY_CACHE_LIMIT = 32
const ADDRESS_PAGE_CACHE_LIMIT = 128

export const requestJson: JsonRequester = (url: string) => new Promise((resolve, reject) => {
  const req = https.get(url, { headers: { accept: 'application/json' } }, res => {
    let body = ''
    res.setEncoding('utf8')
    res.on('data', chunk => { body += chunk })
    res.on('end', () => {
      const status = res.statusCode ?? 500
      if (status < 200 || status >= 300) {
        const error = new Error(`Blockchain API request failed with HTTP ${status}`) as HttpError
        error.status = status
        reject(error)
        return
      }

      try {
        resolve(JSON.parse(body))
      } catch {
        reject(new Error('Blockchain API returned invalid JSON'))
      }
    })
  })

  req.setTimeout(10_000, () => {
    req.destroy(new Error('Blockchain API request timed out'))
  })
  req.on('error', reject)
})

const defaultSleep: Sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

function shouldRetry(error: unknown): boolean {
  const status = (error as HttpError)?.status
  return status === 429 || (typeof status === 'number' && status >= 500)
}

function asTransaction(value: unknown): RawTransaction {
  const candidate = value as Partial<RawTransaction>
  if (
    !candidate ||
    typeof candidate.hash !== 'string' ||
    !candidate.hash ||
    !Number.isSafeInteger(candidate.size) ||
    (candidate.size as number) < 0
  ) {
    throw new Error('Blockchain API returned an invalid transaction payload')
  }
  return { hash: candidate.hash, size: candidate.size as number }
}

function asRawBlock(value: unknown): RawBlock {
  const candidate = value as Partial<RawBlock>
  if (
    !candidate ||
    typeof candidate.hash !== 'string' ||
    !candidate.hash ||
    !Number.isSafeInteger(candidate.time) ||
    (candidate.time as number) < 0 ||
    !Array.isArray(candidate.tx)
  ) {
    throw new Error('Blockchain API returned an invalid block payload')
  }

  return {
    hash: candidate.hash,
    time: candidate.time as number,
    tx: candidate.tx.map(asTransaction),
  }
}

function asBlockReferences(value: unknown): BlockReference[] {
  const source = Array.isArray(value)
    ? value
    : (value as { blocks?: unknown[] } | null)?.blocks

  if (!Array.isArray(source)) {
    throw new Error('Blockchain API returned an invalid day payload')
  }

  return source.map(item => {
    const candidate = item as Partial<BlockReference>
    if (!candidate || typeof candidate.hash !== 'string' || !candidate.hash) {
      throw new Error('Blockchain API returned an invalid block reference')
    }
    return { hash: candidate.hash }
  })
}

function asAddressPage(value: unknown): AddressTransactionsPage {
  const candidate = value as { n_tx?: unknown; txs?: unknown } | null
  if (
    !candidate ||
    !Number.isSafeInteger(candidate.n_tx) ||
    (candidate.n_tx as number) < 0 ||
    !Array.isArray(candidate.txs)
  ) {
    throw new Error('Blockchain API returned an invalid address payload')
  }

  try {
    return {
      totalCount: candidate.n_tx as number,
      transactions: candidate.txs.map(asTransaction),
    }
  } catch {
    throw new Error('Blockchain API returned an invalid address payload')
  }
}

function setBounded<K, V>(cache: Map<K, V>, key: K, value: V, limit: number): void {
  if (!cache.has(key) && cache.size >= limit) {
    const oldestKey = cache.keys().next().value as K | undefined
    if (oldestKey !== undefined) cache.delete(oldestKey)
  }
  cache.set(key, value)
}

export class BlockchainInfoClient implements BlockchainClient {
  private readonly blockCache = new Map<string, Promise<RawBlock>>()
  private readonly dayCache = new Map<number, Promise<BlockReference[]>>()
  private readonly addressPageCache = new Map<string, Promise<AddressTransactionsPage>>()

  constructor(
    private readonly requester: JsonRequester = requestJson,
    private readonly sleep: Sleep = defaultSleep,
  ) {}

  async getBlock(hash: string): Promise<RawBlock> {
    const cached = this.blockCache.get(hash)
    if (cached) return cached

    const pending = this.withRetries(() =>
      this.requester(`https://blockchain.info/rawblock/${encodeURIComponent(hash)}`)
        .then(asRawBlock),
    )
    setBounded(this.blockCache, hash, pending, BLOCK_CACHE_LIMIT)

    try {
      return await pending
    } catch (error) {
      this.blockCache.delete(hash)
      throw error
    }
  }

  async getBlocksAt(timeMs: number): Promise<BlockReference[]> {
    const cached = this.dayCache.get(timeMs)
    if (cached) return cached

    const pending = this.withRetries(() =>
      this.requester(`https://blockchain.info/blocks/${timeMs}?format=json`)
        .then(asBlockReferences),
    )
    setBounded(this.dayCache, timeMs, pending, DAY_CACHE_LIMIT)

    try {
      return await pending
    } catch (error) {
      this.dayCache.delete(timeMs)
      throw error
    }
  }

  async getAddressTransactions(address: string, offset: number): Promise<AddressTransactionsPage> {
    const key = `${address}:${offset}`
    const cached = this.addressPageCache.get(key)
    if (cached) return cached

    const pending = this.withRetries(() =>
      this.requester(
        `https://blockchain.info/rawaddr/${encodeURIComponent(address)}?limit=50&offset=${offset}`,
      ).then(asAddressPage),
    )
    setBounded(this.addressPageCache, key, pending, ADDRESS_PAGE_CACHE_LIMIT)

    try {
      return await pending
    } catch (error) {
      this.addressPageCache.delete(key)
      throw error
    }
  }

  private async withRetries<T>(operation: () => Promise<T>): Promise<T> {
    const maxAttempts = 5
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        return await operation()
      } catch (error) {
        if (attempt === maxAttempts - 1 || !shouldRetry(error)) throw error
        await this.sleep(500 * 2 ** attempt)
      }
    }

    throw new Error('unreachable retry state')
  }
}
