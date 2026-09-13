import {
  AddressTransactionsPage,
  BitcoinEnergyService,
  BlockchainClient,
  RawBlock,
} from '../src/bitcoin-service'

const block = (hash: string, sizes: number[], time = 1_700_000_000): RawBlock => ({
  hash,
  time,
  tx: sizes.map((size, i) => ({ hash: `${hash}-tx-${i}`, size })),
})

class FakeBlockchainClient implements BlockchainClient {
  constructor(
    private readonly blocks: Record<string, RawBlock>,
    private readonly days: Record<number, { hash: string }[]>,
  ) {}

  async getBlock(hash: string): Promise<RawBlock> {
    const value = this.blocks[hash]
    if (!value) throw new Error(`missing block ${hash}`)
    return value
  }

  async getBlocksAt(timeMs: number): Promise<{ hash: string }[]> {
    return this.days[timeMs] ?? []
  }

  async getAddressTransactions(_address: string, _offset: number): Promise<AddressTransactionsPage> {
    return { totalCount: 0, transactions: [] }
  }
}

describe('BitcoinEnergyService', () => {
  it('returns energy consumption per transaction for a block', async () => {
    const client = new FakeBlockchainClient({ alpha: block('alpha', [100, 250]) }, {})
    const service = new BitcoinEnergyService(client)

    await expect(service.blockEnergy('alpha')).resolves.toEqual({
      hash: 'alpha',
      totalEnergyKwh: 1596,
      transactions: [
        { hash: 'alpha-tx-0', sizeBytes: 100, energyKwh: 456 },
        { hash: 'alpha-tx-1', sizeBytes: 250, energyKwh: 1140 },
      ],
    })
  })

  it('aggregates total energy by UTC day for the last x days', async () => {
    const now = new Date('2026-09-13T12:00:00.000Z')
    const day13 = Date.parse('2026-09-13T00:00:00.000Z')
    const day12 = Date.parse('2026-09-12T00:00:00.000Z')
    const client = new FakeBlockchainClient(
      {
        a: block('a', [10, 20]),
        b: block('b', [5]),
        c: block('c', [100]),
      },
      {
        [day13]: [{ hash: 'a' }, { hash: 'b' }],
        [day12]: [{ hash: 'c' }],
      },
    )
    const service = new BitcoinEnergyService(client)

    await expect(service.dailyEnergy(2, now)).resolves.toEqual([
      { date: '2026-09-13', totalEnergyKwh: 159.6, blockCount: 2, transactionCount: 3 },
      { date: '2026-09-12', totalEnergyKwh: 456, blockCount: 1, transactionCount: 1 },
    ])
  })

  it('rejects non-positive or non-integer day windows', async () => {
    const service = new BitcoinEnergyService(new FakeBlockchainClient({}, {}))

    await expect(service.dailyEnergy(0)).rejects.toThrow('days must be a positive integer')
    await expect(service.dailyEnergy(-1)).rejects.toThrow('days must be a positive integer')
    await expect(service.dailyEnergy(1.5)).rejects.toThrow('days must be a positive integer')
  })

  it('does not impose an undocumented maximum on x days', async () => {
    const service = new BitcoinEnergyService(new FakeBlockchainClient({}, {}))
    await expect(service.dailyEnergy(31, new Date('2026-09-13T12:00:00.000Z')))
      .resolves.toHaveLength(31)
  })
})
