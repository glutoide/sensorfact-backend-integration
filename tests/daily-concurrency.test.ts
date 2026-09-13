import {
  AddressTransactionsPage,
  BitcoinEnergyService,
  BlockchainClient,
  RawBlock,
} from '../src/bitcoin-service'

class DelayedClient implements BlockchainClient {
  active = 0
  maxActive = 0

  async getBlock(hash: string): Promise<RawBlock> {
    this.active += 1
    this.maxActive = Math.max(this.maxActive, this.active)
    await new Promise(resolve => setTimeout(resolve, 15))
    this.active -= 1
    return {
      hash,
      time: 1_700_000_000,
      tx: [{ hash: `${hash}-tx`, size: 10 }],
    }
  }

  async getBlocksAt(): Promise<{ hash: string }[]> {
    return Array.from({ length: 8 }, (_, i) => ({ hash: `block-${i}` }))
  }

  async getAddressTransactions(): Promise<AddressTransactionsPage> {
    return { totalCount: 0, transactions: [] }
  }
}

describe('dailyEnergy external-call concurrency', () => {
  it('uses bounded concurrency instead of fetching every block serially', async () => {
    const client = new DelayedClient()
    const service = new BitcoinEnergyService(client)

    const [result] = await service.dailyEnergy(1, new Date('2026-09-13T12:00:00Z'))

    expect(result.blockCount).toBe(8)
    expect(result.transactionCount).toBe(8)
    expect(result.totalEnergyKwh).toBe(364.8)
    expect(client.maxActive).toBeGreaterThan(1)
    expect(client.maxActive).toBeLessThanOrEqual(2)
  })
})
