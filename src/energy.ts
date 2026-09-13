export const ENERGY_KWH_PER_BYTE = 4.56

export function transactionEnergyKwh(sizeBytes: number): number {
  if (sizeBytes < 0) {
    throw new Error('Transaction size must be non-negative')
  }

  return sizeBytes * ENERGY_KWH_PER_BYTE
}
