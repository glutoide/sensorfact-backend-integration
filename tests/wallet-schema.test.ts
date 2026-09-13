import { graphql } from 'graphql'
import { createSchema } from '../src/schema'

describe('GraphQL walletEnergy', () => {
  it('exposes total wallet energy', async () => {
    const schema = createSchema({
      blockEnergy: async () => ({ hash: '', totalEnergyKwh: 0, transactions: [] }),
      dailyEnergy: async () => [],
      walletEnergy: async (address: string) => ({
        address,
        transactionCount: 2,
        totalEnergyKwh: 13.68,
      }),
    })

    const result = await graphql({
      schema,
      source: `query { walletEnergy(address: "wallet-1") { address transactionCount totalEnergyKwh } }`,
    })

    expect(result.errors).toBeUndefined()
    expect(result.data).toEqual({
      walletEnergy: {
        address: 'wallet-1',
        transactionCount: 2,
        totalEnergyKwh: 13.68,
      },
    })
  })
})
