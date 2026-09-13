import { BlockchainInfoClient, JsonRequester } from '../src/blockchain-client'

describe('BlockchainInfoClient', () => {
  it('caches raw block responses to avoid duplicate API calls', async () => {
    let calls = 0
    const request: JsonRequester = async () => {
      calls += 1
      return { hash: 'abc', time: 1, tx: [{ hash: 'tx', size: 10 }] }
    }
    const client = new BlockchainInfoClient(request, async () => undefined)

    await client.getBlock('abc')
    await client.getBlock('abc')

    expect(calls).toBe(1)
  })

  it('retries a rate-limited request with a meaningful backoff', async () => {
    let calls = 0
    const request: JsonRequester = async () => {
      calls += 1
      if (calls < 3) {
        const error = new Error('rate limited') as Error & { status?: number }
        error.status = 429
        throw error
      }
      return { blocks: [{ hash: 'block-1' }] }
    }
    const waits: number[] = []
    const client = new BlockchainInfoClient(request, async ms => { waits.push(ms) })

    await expect(client.getBlocksAt(123)).resolves.toEqual([{ hash: 'block-1' }])
    expect(calls).toBe(3)
    expect(waits).toEqual([500, 1000])
  })

  it('recovers after a longer burst of 429 responses', async () => {
    let calls = 0
    const request: JsonRequester = async () => {
      calls += 1
      if (calls < 5) {
        const error = new Error('rate limited') as Error & { status?: number }
        error.status = 429
        throw error
      }
      return { hash: 'abc', time: 1, tx: [] }
    }
    const waits: number[] = []
    const client = new BlockchainInfoClient(request, async ms => { waits.push(ms) })

    await expect(client.getBlock('abc')).resolves.toMatchObject({ hash: 'abc' })
    expect(calls).toBe(5)
    expect(waits).toEqual([500, 1000, 2000, 4000])
  })

  it('does not retry a permanent 4xx response', async () => {
    let calls = 0
    const request: JsonRequester = async () => {
      calls += 1
      const error = new Error('not found') as Error & { status?: number }
      error.status = 404
      throw error
    }
    const client = new BlockchainInfoClient(request, async () => undefined)

    await expect(client.getBlock('missing')).rejects.toThrow('not found')
    expect(calls).toBe(1)
  })
})
