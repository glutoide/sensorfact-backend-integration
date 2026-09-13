import { transactionEnergyKwh } from '../src/energy'

describe('transactionEnergyKwh', () => {
  it('calculates energy from transaction size using 4.56 kWh per byte', () => {
    expect(transactionEnergyKwh(250)).toBe(1140)
  })

  it('returns zero for an empty transaction payload', () => {
    expect(transactionEnergyKwh(0)).toBe(0)
  })

  it('rejects negative transaction sizes', () => {
    expect(() => transactionEnergyKwh(-1)).toThrow('Transaction size must be non-negative')
  })
})
