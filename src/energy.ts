export const ENERGY_KWH_PER_BYTE = 4.56

export function roundEnergyKwh(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000
}

export function transactionEnergyKwh(sizeBytes: number): number {
  if (sizeBytes < 0) {
    throw new Error('Transaction size must be non-negative')
  }

  return roundEnergyKwh(sizeBytes * ENERGY_KWH_PER_BYTE)
}
