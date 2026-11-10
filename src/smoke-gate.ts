/**
 * G2 HUMAN-CONTROLLED SMOKE-TEST GATE.
 * This module cannot send money. It only evaluates whether the UI may OFFER
 * one native Nimiq Pay wallet confirmation. A second host-side guard is required.
 */
export const SMOKE_MAX_LUNA = 1_000; // 0.01 NIM; not a legitimate monthly rental amount.
export const MAX_RPC_AGE_MS = 2 * 60_000;
export const MAX_BLOCK_HEIGHT_DRIFT = 1_000;
export type NimiqHostNetwork = 'mainnet'|'testnet'|'unknown';
export interface SmokeContext {
  buildAllowsSmoke: boolean;
  walletNetwork: NimiqHostNetwork;
  consensus: boolean;
  walletBlockHeight: number | null;
  publicRpcNetwork: string | null;
  publicRpcBlockHeight: number | null;
  publicRpcObservedAt: string | null;
  nowMs: number;
  amountLuna: number;
  recipientCheckAcknowledged: boolean;
  realMoneyAcknowledged: boolean;
  walletApprovalAcknowledged: boolean;
  priorAttemptUnresolved: boolean;
  recipient: string;
  memo: string;
}
export interface SmokeAssessment { allowed: boolean; reasons: string[]; }
export function assessSmokePayment(ctx: SmokeContext): SmokeAssessment {
  const reasons: string[]=[];
  if(!ctx.buildAllowsSmoke) reasons.push('This build is read-only. Payments are disabled.');
  if(ctx.walletNetwork!=='mainnet') reasons.push('Nimiq Pay host must explicitly report mainnet.');
  if(ctx.consensus!==true) reasons.push('Nimiq Pay consensus must be established.');
  if(!Number.isSafeInteger(ctx.walletBlockHeight) || (ctx.walletBlockHeight??-1)<1) {
    reasons.push('Wallet mainnet height is unavailable.');
  }
  if(ctx.publicRpcNetwork!=='MainAlbatross') reasons.push('Independent RPC must report MainAlbatross.');
  if(!Number.isSafeInteger(ctx.publicRpcBlockHeight) || (ctx.publicRpcBlockHeight??-1)<1) {
    reasons.push('Independent RPC head height is unavailable.');
  }
  const observed=ctx.publicRpcObservedAt?Date.parse(ctx.publicRpcObservedAt):NaN;
  if(!Number.isFinite(observed)||observed>ctx.nowMs+10_000||ctx.nowMs-observed>MAX_RPC_AGE_MS){
    reasons.push('Independent RPC observation is missing, stale or in the future.');
  }
  if(Number.isSafeInteger(ctx.walletBlockHeight) && Number.isSafeInteger(ctx.publicRpcBlockHeight) &&
    Math.abs((ctx.walletBlockHeight??0)-(ctx.publicRpcBlockHeight??0))>MAX_BLOCK_HEIGHT_DRIFT){
    reasons.push('Wallet and public RPC block heights diverge. Verify the selected network.');
  }
  if(!Number.isSafeInteger(ctx.amountLuna)||ctx.amountLuna<1||ctx.amountLuna>SMOKE_MAX_LUNA) {
    reasons.push('Smoke payment must be >0 and at most 0.01 NIM.');
  }
  if(!/^NQ[0-9]{2}[0-9A-HJ-NP-VX-Y]{32}$/.test(ctx.recipient.replace(/\s+/g,'').toUpperCase())){
    reasons.push('Recipient address structure is invalid.');
  }
  if(!/^RR1:[0-9a-f]{32}$/.test(ctx.memo)) reasons.push('Only opaque rent references are allowed.');
  if(!ctx.recipientCheckAcknowledged) reasons.push('Confirm recipient with the payee outside this unsigned link.');
  if(!ctx.realMoneyAcknowledged) reasons.push('Acknowledge that this transfers REAL mainnet NIM.');
  if(!ctx.walletApprovalAcknowledged) reasons.push('Acknowledge that native wallet approval is still required.');
  if(ctx.priorAttemptUnresolved) reasons.push('Previous send is unresolved; do not retry.');
  return {allowed:reasons.length===0,reasons};
}
