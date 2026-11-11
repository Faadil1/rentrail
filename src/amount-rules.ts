/** 0.01 NIM. Nimiq Pay's confirmation sheet shows two decimals, so amounts are kept to 2 decimals. */
export const MIN_PAYABLE_LUNA = 1000;

/** Returns a user-facing reason why this amount cannot be paid, or null if it can. */
export function payableAmountIssue(amountLuna: number): string | null {
  if (!Number.isSafeInteger(amountLuna) || amountLuna < MIN_PAYABLE_LUNA) return 'The minimum rent request is 0.01 NIM.';
  if (amountLuna % MIN_PAYABLE_LUNA !== 0) return 'Use at most 2 decimals (for example 12.50 NIM) so the amount shown by Nimiq Pay is exact.';
  return null;
}
