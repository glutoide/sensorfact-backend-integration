import { BitcoinEnergyService, BlockchainClient, RawBlock, RawTransaction } from '../src/bitcoin-service'

describe('BitcoinEnergyService.walletEnergy', () => {
  it('aggregates wallet transaction energy across all paginated results', async () => {
    const page0: RawTransaction[] = Array.from({ length: 50 }, (_, index) => ({
      hash: `tx-${index}`,
      size: 1,
    }))
    const page50: RawTransaction[] = [{ hash: 'tx-50', size: 2 }]

    const client: BlockchainClient = {
      getBlock: async (_hash: string): Promise<RawBlock> => { throw new Error('unused') },
      getBlocksAt: async () => [],
      getAddressTransactions: async (_address: string, offset: number) => ({
        totalCount: 51,
        transactions: offset === 0 ? page0 : page50,
      }),
    }

    const service = new BitcoinEnergyService(client)

    await expect(service.walletEnergy('wallet-1')).resolves.toEqual({
      address: 'wallet-1',
      transactionCount: 51,
      totalEnergyKwh: 237.12,
    })
  })

  it('rejects an empty wallet address', async () => {
    const service = new BitcoinEnergyService({} as BlockchainClient)
    await expect(service.walletEnergy('   ')).rejects.toThrow('wallet address is required')
  })
})
