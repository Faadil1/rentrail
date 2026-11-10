import { isValidNimiqAddress, compactNimiqAddress } from './address-validation.ts';
import { type SharedRequest } from './domain.ts';

/**
 * This exact-transaction gate is deliberately additional to the prior G2:
 * host mainnet, RPC, account-list, explicit human consent and native dialog.
 * Never mistake it for network-wide one-time spend authorization.
 */
export const PILOT_LUNA=500;
export const PILOT_PERIOD='2026-11';
// Automatic sunset shortly before the hackathon submission cutoff.
// Device clocks are not trusted security boundaries; isolate and disable this deployment after the test.
export const PILOT_EXPIRES_AT_MS = Date.parse('2026-11-11T23:45:00Z');
export interface PilotConfig {
  recipient: string | undefined;
  chargeId: string | undefined;
  amountLuna: string | undefined;
  period: string | undefined;
}
export interface PilotCheck { allowed:boolean; reasons:string[] }

export function checkPilotRequest(request: SharedRequest, config: PilotConfig, nowMs=Date.now()):PilotCheck {
  const reasons:string[]=[];
  if(!Number.isFinite(nowMs)||nowMs>=PILOT_EXPIRES_AT_MS)reasons.push('The authorized one-off pilot has expired. Payments are disabled.');
  if(config.amountLuna!=='500'||request.amountLuna!==PILOT_LUNA)
    reasons.push('Only the explicitly approved amount of 0.005 NIM (500 Luna) is permitted.');
  if(config.period!==PILOT_PERIOD||request.period!==PILOT_PERIOD)
    reasons.push('The authorized pilot is limited to the November 2026 fictional request.');
  if(typeof config.chargeId!=='string'||!/^[0-9a-f]{32}$/.test(config.chargeId)||
     request.chargeId!==config.chargeId||
     request.memo!==`RR1:${config.chargeId}`){
    reasons.push('The transaction must match the exact approved, opaque pilot reference.');
  }
  if(typeof config.recipient!=='string'||!isValidNimiqAddress(config.recipient)||
     !isValidNimiqAddress(request.recipient)||
     compactNimiqAddress(config.recipient)!==compactNimiqAddress(request.recipient))
    reasons.push('The receiving wallet does not match the exact authorized NQ address.');
  return {allowed:reasons.length===0,reasons};
}
