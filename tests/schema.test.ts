import { graphql } from 'graphql'
import { createSchema } from '../src/schema'

describe('GraphQL schema', () => {
  it('exposes transaction energy for a requested block', async () => {
    const service = {
      blockEnergy: async () => ({
        hash: 'abc',
        totalEnergyKwh: 136.8,
        transactions: [{ hash: 'tx1', sizeBytes: 30, energyKwh: 136.8 }],
      }),
      dailyEnergy: async () => [],
      walletEnergy: async () => ({ address: '', totalEnergyKwh: 0, transactionCount: 0 }),
    }
    const schema = createSchema(service)

    const result = await graphql({
      schema,
      source: `query { blockEnergy(blockHash: "abc") { hash totalEnergyKwh transactions { hash sizeBytes energyKwh } } }`,
    })

    expect(result.errors).toBeUndefined()
    expect(result.data).toEqual({
      blockEnergy: {
        hash: 'abc',
        totalEnergyKwh: 136.8,
        transactions: [{ hash: 'tx1', sizeBytes: 30, energyKwh: 136.8 }],
      },
    })
  })

  it('exposes daily energy for the requested window', async () => {
    const service = {
      blockEnergy: async () => ({ hash: '', totalEnergyKwh: 0, transactions: [] }),
      dailyEnergy: async (days: number) => [{
        date: '2026-09-13',
        totalEnergyKwh: days * 10,
        blockCount: 2,
        transactionCount: 3,
      }],
      walletEnergy: async () => ({ address: '', totalEnergyKwh: 0, transactionCount: 0 }),
    }
    const schema = createSchema(service)

    const result = await graphql({
      schema,
      source: `query { dailyEnergy(days: 2) { date totalEnergyKwh blockCount transactionCount } }`,
    })

    expect(result.errors).toBeUndefined()
    expect(result.data).toEqual({
      dailyEnergy: [{
        date: '2026-09-13',
        totalEnergyKwh: 20,
        blockCount: 2,
        transactionCount: 3,
      }],
    })
  })
})
