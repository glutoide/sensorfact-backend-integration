import { roundEnergyKwh, transactionEnergyKwh } from './energy'

export type RawTransaction = {
  hash: string
  size: number
}

export type RawBlock = {
  hash: string
  time: number
  tx: RawTransaction[]
}

export type BlockReference = {
  hash: string
}

export type AddressTransactionsPage = {
  totalCount: number
  transactions: RawTransaction[]
}

export interface BlockchainClient {
  getBlock(hash: string): Promise<RawBlock>
  getBlocksAt(timeMs: number): Promise<BlockReference[]>
  getAddressTransactions(address: string, offset: number): Promise<AddressTransactionsPage>
}

export type TransactionEnergy = {
  hash: string
  sizeBytes: number
  energyKwh: number
}

export type BlockEnergy = {
  hash: string
  totalEnergyKwh: number
  transactions: TransactionEnergy[]
}

export type DailyEnergy = {
  date: string
  totalEnergyKwh: number
  blockCount: number
  transactionCount: number
}

export type WalletEnergy = {
  address: string
  totalEnergyKwh: number
  transactionCount: number
}

const DAILY_BLOCK_CONCURRENCY = 3

function utcDayStartMs(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

function isoDay(timeMs: number): string {
  return new Date(timeMs).toISOString().slice(0, 10)
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length)
  let nextIndex = 0
  let failed = false

  async function worker() {
    while (!failed && nextIndex < values.length) {
      const index = nextIndex
      nextIndex += 1
      try {
        results[index] = await mapper(values[index])
      } catch (error) {
        failed = true
        throw error
      }
    }
  }

  const workerCount = Math.min(concurrency, values.length)
  await Promise.all(Array.from({ length: workerCount }, () => worker()))
  return results
}

export class BitcoinEnergyService {
  constructor(private readonly client: BlockchainClient) {}

  async blockEnergy(hash: string): Promise<BlockEnergy> {
    const cleanHash = hash.trim()
    if (!cleanHash) throw new Error('block hash is required')

    const block = await this.client.getBlock(cleanHash)
    const transactions = block.tx.map(tx => ({
      hash: tx.hash,
      sizeBytes: tx.size,
      energyKwh: transactionEnergyKwh(tx.size),
    }))

    return {
      hash: block.hash,
      totalEnergyKwh: roundEnergyKwh(
        transactions.reduce((sum, tx) => sum + tx.energyKwh, 0),
      ),
      transactions,
    }
  }

  async dailyEnergy(days: number, now = new Date()): Promise<DailyEnergy[]> {
    if (!Number.isInteger(days) || days < 1) {
      throw new Error('days must be a positive integer')
    }

    const currentDay = utcDayStartMs(now)
    const results: DailyEnergy[] = []

    for (let offset = 0; offset < days; offset += 1) {
      const dayMs = currentDay - offset * 24 * 60 * 60 * 1000
      const refs = await this.client.getBlocksAt(dayMs)
      const blocks = await mapWithConcurrency(
        refs,
        DAILY_BLOCK_CONCURRENCY,
        ref => this.client.getBlock(ref.hash),
      )

      let totalEnergyKwh = 0
      let transactionCount = 0
      for (const block of blocks) {
        transactionCount += block.tx.length
        totalEnergyKwh += block.tx.reduce(
          (sum, tx) => sum + transactionEnergyKwh(tx.size),
          0,
        )
      }

      results.push({
        date: isoDay(dayMs),
        totalEnergyKwh: roundEnergyKwh(totalEnergyKwh),
        blockCount: refs.length,
        transactionCount,
      })
    }

    return results
  }

  async walletEnergy(address: string): Promise<WalletEnergy> {
    const cleanAddress = address.trim()
    if (!cleanAddress) throw new Error('wallet address is required')

    let offset = 0
    let totalCount = Number.POSITIVE_INFINITY
    let totalEnergyKwh = 0
    let transactionCount = 0

    while (offset < totalCount) {
      const page = await this.client.getAddressTransactions(cleanAddress, offset)
      totalCount = page.totalCount

      if (page.transactions.length === 0 && offset < totalCount) {
        throw new Error('Blockchain API pagination ended before n_tx')
      }

      transactionCount += page.transactions.length
      totalEnergyKwh += page.transactions.reduce(
        (sum, tx) => sum + transactionEnergyKwh(tx.size),
        0,
      )
      offset += page.transactions.length
    }

    return {
      address: cleanAddress,
      transactionCount,
      totalEnergyKwh: roundEnergyKwh(totalEnergyKwh),
    }
  }
}
