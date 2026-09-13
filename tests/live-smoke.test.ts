import { BitcoinEnergyService } from '../src/bitcoin-service'
import { BlockchainInfoClient, requestJson } from '../src/blockchain-client'

const describeLive = process.env.RUN_LIVE_SMOKE === '1' ? describe : describe.skip

describeLive('Blockchain.com live smoke', () => {
  jest.setTimeout(30_000)

  it('reads the latest real block through the production client/service', async () => {
    const latest = await requestJson('https://blockchain.info/latestblock') as { hash?: unknown }
    expect(typeof latest.hash).toBe('string')

    const service = new BitcoinEnergyService(new BlockchainInfoClient())
    const block = await service.blockEnergy(latest.hash as string)

    expect(block.hash).toBe(latest.hash)
    expect(block.transactions.length).toBeGreaterThan(0)
    expect(block.totalEnergyKwh).toBeGreaterThan(0)
  })

  it('reads a documented real wallet address through pagination', async () => {
    const service = new BitcoinEnergyService(new BlockchainInfoClient())
    const wallet = await service.walletEnergy('1AJbsFZ64EpEfS5UAjAfcUG8pH8Jn3rn1F')

    expect(wallet.transactionCount).toBeGreaterThan(0)
    expect(wallet.totalEnergyKwh).toBeGreaterThan(0)
  })
})
