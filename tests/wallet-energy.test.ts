import { BitcoinEnergyService, BlockchainClient, RawBlock, RawTransaction } from '../src/bitcoin-service'

describe('BitcoinEnergyService.walletEnergy', () => {
  it('aggregates wallet transaction energy across paginated results', async () => {
    const pages: RawTransaction[][] = [
      [
        { hash: 'tx-1', size: 100 },
        { hash: 'tx-2', size: 50 },
      ],
      [{ hash: 'tx-3', size: 25 }],
    ]

    const client: BlockchainClient = {
      getBlock: async (_hash: string): Promise<RawBlock> => { throw new Error('unused') },
      getBlocksAt: async () => [],
      getAddressTransactions: async (_address: string, offset: number) => pages[offset / 50] ?? [],
    }

    const service = new BitcoinEnergyService(client)

    await expect(service.walletEnergy('wallet-1')).resolves.toEqual({
      address: 'wallet-1',
      transactionCount: 3,
      totalEnergyKwh: 798,
    })
  })

  it('rejects an empty wallet address', async () => {
    const service = new BitcoinEnergyService({} as BlockchainClient)
    await expect(service.walletEnergy('   ')).rejects.toThrow('wallet address is required')
  })
})
