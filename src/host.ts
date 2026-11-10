import { isValidNimiqAddress } from './address-validation.ts';
import { init, getHostNetwork, NimiqProviderError } from '@nimiq/mini-app-sdk';
import { SMOKE_MAX_LUNA, type NimiqHostNetwork, type SmokeAssessment } from './smoke-gate.ts';
import { isSafeLuna, validateSharedRequest, looksLikeNimiqAddress, normalizeAddress, type SharedRequest } from './domain.ts';

export type NimiqHost = Awaited<ReturnType<typeof init>>;
export interface HostCheck {
  provider: NimiqHost;
  consensus: boolean;
  blockHeight: number | null;
  balanceReadAvailable: boolean;
  network: NimiqHostNetwork;
  checkedAtMs: number;
}
export async function checkHost(): Promise<HostCheck> {
  const provider = await init();
  const consensus = await provider.isConsensusEstablished();
  let blockHeight: number | null = null;
  if (consensus) {
    const n = await provider.getBlockNumber();
    if (Number.isSafeInteger(n) && n >= 0) blockHeight = n;
  }
  const detected = getHostNetwork();
  const network: NimiqHostNetwork = detected==='mainnet'||detected==='testnet' ? detected : 'unknown';
  return { provider, consensus, blockHeight, network, checkedAtMs:Date.now(), balanceReadAvailable: typeof provider.getBalance === 'function' };
}
export function explainHostError(error: unknown): string {
  if (NimiqProviderError.is(error)) {
    if (error.type === 'PERMISSION_DENIED') return 'Wallet permission was declined. You can try again when ready.';
    if (error.type === 'NETWORK_ERROR') return 'Nimiq Pay reported a network error. Check connectivity and payment history before retrying.';
    return `Nimiq Pay: ${error.type}. ${error.message}`;
  }
  return error instanceof Error ? error.message : 'Nimiq Pay could not be reached.';
}
/**
 * The only money-moving adapter, called exclusively by a direct human click.
 * This is a tightly capped contest smoke-test path, not a general rent payer.
 * The build switch remains OFF in every public/staging deployment by default.
 */
export async function submitUserApprovedPayment(
  host: HostCheck, request: SharedRequest, assessment: SmokeAssessment
): Promise<string> {
  if(import.meta.env.VITE_ENABLE_LIVE_NIM_SEND!=='smoke_test_human_approved')
    throw Error('This build is read-only; sending NIM is disabled.');
  if(!assessment.allowed) throw Error('Independent safety and consent gate did not pass.');
  const allowedRecipient=import.meta.env.VITE_SMOKE_ALLOW_RECIPIENT;
  if(typeof allowedRecipient!=='string'||!isValidNimiqAddress(allowedRecipient)||
     !isValidNimiqAddress(request.recipient)||
     allowedRecipient.replace(/\s+/g,'').toUpperCase()!==request.recipient.replace(/\s+/g,'').toUpperCase())
    throw Error('Payment recipient is not included in the approved smoke-test build allowlist.');
  const payload=validateSharedRequest(request);
  if(!isSafeLuna(payload.amountLuna)||payload.amountLuna>SMOKE_MAX_LUNA)
    throw Error('The maximum explicitly controlled smoke amount is 0.01 NIM.');
  if(host.network!=='mainnet'||getHostNetwork()!=='mainnet')
    throw Error('The Nimiq Pay host did not explicitly report mainnet. No payment was requested.');
  if(!host.consensus||!(await host.provider.isConsensusEstablished()))
    throw Error('Nimiq Pay consensus unavailable. No payment was requested.');
  // Re-read the wallet-shared addresses immediately before any native send.
  // The wallet picks the actual sender. Never treat list ordering as signer identity.
  const shared=await host.provider.listAccounts();
  if(!Array.isArray(shared)||shared.length===0||shared.some(a=>typeof a!=='string'||!looksLikeNimiqAddress(a))){
    throw Error('Wallet payer addresses must be explicitly shared and structurally valid before any payment.');
  }
  if(shared.some(a=>normalizeAddress(a)===normalizeAddress(payload.recipient))){
    throw Error('Self-transfer risk: recipient belongs to this payer wallet; Nimiq forbids sender = recipient. No payment requested.');
  }
  // Native wallet confirmation is mandatory. No seed phrase or private key is requested.
  const hash=await host.provider.sendBasicTransactionWithData({
    recipient:payload.recipient, value:payload.amountLuna, data:payload.memo,
  });
  // A returned hash is only SUBMITTED_UNVERIFIED; NEVER a settled rent receipt.
  if(typeof hash!=='string'||!/^[0-9a-f]{64}$/i.test(hash))
    throw Error('Unexpected wallet response after a send request. Outcome UNKNOWN: inspect wallet history and do not retry.');
  return hash.toLowerCase();
}
