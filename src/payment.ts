import { init, getHostNetwork, NimiqProviderError } from '@nimiq/mini-app-sdk';
import { isValidNimiqAddress } from './address-validation.ts';
import { formatNim, validateSharedRequest, type SharedRequest } from './domain.ts';
import {signedPaymentIntegrityError} from './payment-integrity.ts';

export { MIN_PAYABLE_LUNA, payableAmountIssue } from './amount-rules.ts';
import { payableAmountIssue } from './amount-rules.ts';

export type PayErrorKind = 'NOT_IN_NIMIQ_PAY' | 'WRONG_NETWORK' | 'NO_CONSENSUS' | 'DECLINED' | 'INVALID_REQUEST' | 'UNKNOWN_OUTCOME';
export class PayError extends Error {
  constructor(public kind: PayErrorKind, message: string) { super(message); }
}

/**
 * Opens the native Nimiq Pay confirmation for exactly this rent request.
 * The tenant approves (or cancels) in Nimiq Pay; RentRail never sees keys.
 * The returned hash is only "sent": the caller must verify it on-chain.
 */
export async function payRentRequest(raw: SharedRequest): Promise<string> {
  let request: SharedRequest;
  try { request = validateSharedRequest(raw); } catch (e) { throw new PayError('INVALID_REQUEST', e instanceof Error ? e.message : 'Invalid request.'); }
  if (!isValidNimiqAddress(request.recipient)) throw new PayError('INVALID_REQUEST', 'The receiving address checksum is invalid. Nothing was sent.');
  const integrityError=signedPaymentIntegrityError(request);
  if(integrityError)throw new PayError('INVALID_REQUEST',integrityError);
  const amountIssue = payableAmountIssue(request.amountLuna);
  if (amountIssue) throw new PayError('INVALID_REQUEST', amountIssue);

  let provider: Awaited<ReturnType<typeof init>>;
  try { provider = await init({ timeout: 8000 }); }
  catch { throw new PayError('NOT_IN_NIMIQ_PAY', 'Open this link inside Nimiq Pay (Mini Apps) to pay with your wallet.'); }
  const network = getHostNetwork();
  if (network !== undefined && network !== 'mainnet') throw new PayError('WRONG_NETWORK', 'Nimiq Pay is on testnet. Switch to mainnet to pay rent.');
  if (!(await provider.isConsensusEstablished())) throw new PayError('NO_CONSENSUS', 'Nimiq Pay is still syncing with the network. Try again in a few seconds.');

  let hash: unknown;
  try {
    hash = await provider.sendBasicTransactionWithData({ recipient: request.recipient, value: request.amountLuna, data: request.memo });
  } catch (error) {
    if (NimiqProviderError.is(error) && (error.type === 'PERMISSION_DENIED' || /reject|cancel|denied/i.test(error.message)))
      throw new PayError('DECLINED', 'Payment cancelled in Nimiq Pay. Nothing was sent.');
    throw new PayError('UNKNOWN_OUTCOME', 'Nimiq Pay did not confirm the outcome. Check your wallet history before paying again.');
  }
  if (typeof hash !== 'string' || !/^[0-9a-f]{64}$/i.test(hash))
    throw new PayError('UNKNOWN_OUTCOME', 'Nimiq Pay returned an unexpected response. Check your wallet history before paying again.');
  return hash.toLowerCase();
}

export function payButtonLabel(request: SharedRequest): string {
  return `Pay ${formatNim(request.amountLuna)} NIM with Nimiq Pay`;
}
