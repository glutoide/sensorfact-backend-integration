import { BlockchainInfoClient, JsonRequester } from '../src/blockchain-client'

describe('BlockchainInfoClient.getAddressTransactions', () => {
  it('parses address transactions and uses limit/offset pagination', async () => {
    const urls: string[] = []
    const request: JsonRequester = async url => {
      urls.push(url)
      return {
        address: 'wallet-1',
        n_tx: 1,
        txs: [{ hash: 'tx-1', size: 123 }],
      }
    }

    const client = new BlockchainInfoClient(request, async () => undefined)
    await expect(client.getAddressTransactions('wallet-1', 50)).resolves.toEqual([
      { hash: 'tx-1', size: 123 },
    ])

    expect(urls).toEqual([
      'https://blockchain.info/rawaddr/wallet-1?limit=50&offset=50',
    ])
  })

  it('rejects malformed address payloads', async () => {
    const client = new BlockchainInfoClient(async () => ({ txs: [{ hash: 'tx-1' }] }), async () => undefined)
    await expect(client.getAddressTransactions('wallet-1', 0)).rejects.toThrow('invalid address payload')
  })
})
