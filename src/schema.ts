import { SchemaComposer } from 'graphql-compose'
import { BitcoinEnergyService } from './bitcoin-service'
import { BlockchainInfoClient } from './blockchain-client'

type EnergyService = Pick<BitcoinEnergyService, 'blockEnergy' | 'dailyEnergy'>

export function createSchema(service: EnergyService) {
  const schemaComposer = new SchemaComposer()

  const TransactionEnergyTC = schemaComposer.createObjectTC({
    name: 'TransactionEnergy',
    fields: {
      hash: 'String!',
      sizeBytes: 'Int!',
      energyKwh: 'Float!',
    },
  })

  const BlockEnergyTC = schemaComposer.createObjectTC({
    name: 'BlockEnergy',
    fields: {
      hash: 'String!',
      totalEnergyKwh: 'Float!',
      transactions: [TransactionEnergyTC.NonNull],
    },
  })

  const DailyEnergyTC = schemaComposer.createObjectTC({
    name: 'DailyEnergy',
    fields: {
      date: 'String!',
      totalEnergyKwh: 'Float!',
      blockCount: 'Int!',
      transactionCount: 'Int!',
    },
  })

  schemaComposer.Query.addFields({
    blockEnergy: {
      type: BlockEnergyTC.NonNull,
      args: {
        blockHash: 'String!',
      },
      resolve: (_source, args: { blockHash: string }) => service.blockEnergy(args.blockHash),
    },
    dailyEnergy: {
      type: [DailyEnergyTC.NonNull],
      args: {
        days: 'Int!',
      },
      resolve: (_source, args: { days: number }) => service.dailyEnergy(args.days),
    },
  })

  return schemaComposer.buildSchema()
}

const client = new BlockchainInfoClient()
const service = new BitcoinEnergyService(client)

export const schema = createSchema(service)
