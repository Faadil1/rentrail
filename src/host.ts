import { init, NimiqProviderError } from '@nimiq/mini-app-sdk';
import { isSafeLuna, looksLikeNimiqAddress, type SharedRequest } from './domain.ts';

export type NimiqHost = Awaited<ReturnType<typeof init>>;
export interface HostCheck {
  provider: NimiqHost;
  consensus: boolean;
  blockHeight: number | null;
  balanceReadAvailable: boolean;
}
export async function checkHost(): Promise<HostCheck> {
  const provider = await init();
  const consensus = await provider.isConsensusEstablished();
  let blockHeight: number | null = null;
  if (consensus) {
    const n = await provider.getBlockNumber();
    if (Number.isSafeInteger(n) && n >= 0) blockHeight = n;
  }
  return { provider, consensus, blockHeight, balanceReadAvailable: typeof provider.getBalance === 'function' };
}
export function explainHostError(error: unknown): string {
  if (NimiqProviderError.is(error)) {
    if (error.type === 'PERMISSION_DENIED') return 'Wallet permission was declined. You can try again when ready.';
    if (error.type === 'NETWORK_ERROR') return 'Nimiq Pay reported a network error. Check connectivity and payment history before retrying.';
    return `Nimiq Pay: ${error.type}. ${error.message}`;
  }
  return error instanceof Error ? error.message : 'Nimiq Pay could not be reached.';
}
/** The only money-moving adapter: invoked from an explicit user-initiated click. */
export async function submitUserApprovedPayment(provider: NimiqHost, request: SharedRequest): Promise<string> {
  if (!looksLikeNimiqAddress(request.recipient) || !isSafeLuna(request.amountLuna) || !/^RR1:[a-f0-9]{32}$/.test(request.memo)) {
    throw new Error('Payment request failed validation.');
  }
  if (new TextEncoder().encode(request.memo).length > 64) throw new Error('Public message too long.');
  if (!(await provider.isConsensusEstablished())) throw new Error('Nimiq consensus is not established. No payment was requested.');
  // Nimiq Pay selects signer and always requires native user approval.
  const hash = await provider.sendBasicTransactionWithData({
    recipient: request.recipient,
    value: request.amountLuna,
    data: request.memo,
  });
  if (!/^[a-f0-9]{64}$/i.test(hash)) throw new Error('Unexpected response after wallet action. Outcome is UNKNOWN; inspect wallet history before retrying.');
  return hash;
}