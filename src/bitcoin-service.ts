import { transactionEnergyKwh } from './energy'

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

export interface BlockchainClient {
  getBlock(hash: string): Promise<RawBlock>
  getBlocksAt(timeMs: number): Promise<BlockReference[]>
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

function utcDayStartMs(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

function isoDay(timeMs: number): string {
  return new Date(timeMs).toISOString().slice(0, 10)
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
      totalEnergyKwh: transactions.reduce((sum, tx) => sum + tx.energyKwh, 0),
      transactions,
    }
  }

  async dailyEnergy(days: number, now = new Date()): Promise<DailyEnergy[]> {
    if (!Number.isInteger(days) || days < 1 || days > 30) {
      throw new Error('days must be between 1 and 30')
    }

    const currentDay = utcDayStartMs(now)
    const results: DailyEnergy[] = []

    for (let offset = 0; offset < days; offset += 1) {
      const dayMs = currentDay - offset * 24 * 60 * 60 * 1000
      const refs = await this.client.getBlocksAt(dayMs)
      let totalEnergyKwh = 0
      let transactionCount = 0

      for (const ref of refs) {
        const block = await this.client.getBlock(ref.hash)
        transactionCount += block.tx.length
        totalEnergyKwh += block.tx.reduce(
          (sum, tx) => sum + transactionEnergyKwh(tx.size),
          0,
        )
      }

      results.push({
        date: isoDay(dayMs),
        totalEnergyKwh,
        blockCount: refs.length,
        transactionCount,
      })
    }

    return results
  }
}
