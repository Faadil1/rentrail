import { projectCharge, type Charge, type Submission, type Reconciliation, type TransferEvidence, isSafeLuna } from './domain.ts';
import type { VerifyResult } from './rpc.ts';

/**
 * Only public on-chain hash references are saved. NO settlement result persists.
 * The browser must re-ask its independent read-only mainnet RPC to compute credit.
 */
export interface ProofClaim { chargeId:string; hash:string; recordedAt:string }
export const PROOF_STORAGE_KEY='rentrail-proof-claims-v1';
export const MAX_CLAIMS_PER_CHARGE=8;
export const MAX_CLAIMS_TOTAL=200;
const HASH=/^[0-9a-f]{64}$/i;
const ID=/^[0-9a-f]{32}$/;
const normalHash=(value:string):string=>value.trim().toLowerCase();

function validateClaim(claim:unknown):ProofClaim {
  if(!claim || typeof claim!=='object' || Array.isArray(claim))throw Error('Invalid local proof reference.');
  const r=claim as Record<string,unknown>;
  if(typeof r.chargeId!=='string'||!ID.test(r.chargeId))throw Error('Invalid referenced charge ID.');
  if(typeof r.hash!=='string'||!HASH.test(r.hash))throw Error('Expected a 64-hex Nimiq transaction hash.');
  if(typeof r.recordedAt!=='string'||!Number.isFinite(Date.parse(r.recordedAt))||
    !/^[0-9]{4}-[0-9]{2}-[0-9]{2}T/.test(r.recordedAt))throw Error('Invalid local claim date.');
  return {chargeId:r.chargeId,hash:r.hash.toLowerCase(),recordedAt:r.recordedAt};
}
export function parseProofClaims(raw:unknown):ProofClaim[] {
  if(!Array.isArray(raw)||raw.length>MAX_CLAIMS_TOTAL)throw Error('Invalid local proof claim collection.');
  const normalized=raw.map(validateClaim);
  const seen=new Set<string>(),counts=new Map<string,number>();
  for(const c of normalized){
    if(seen.has(c.hash))throw Error('Duplicate transaction hash in local proof inbox.');
    seen.add(c.hash);
    const n=(counts.get(c.chargeId)||0)+1;
    if(n>MAX_CLAIMS_PER_CHARGE)throw Error('Too many proofs for the same charge.');
    counts.set(c.chargeId,n);
  }
  return normalized;
}
export function addProofClaim(
  existing:ProofClaim[], chargeId:string, hash:string, knownChargeIds:string[],
  recordedAt=new Date().toISOString(),
):ProofClaim[] {
  const current=parseProofClaims(existing);
  if(!knownChargeIds.includes(chargeId)||!ID.test(chargeId))throw Error('Choose a known local rent obligation.');
  if(typeof hash!=='string'||!HASH.test(hash.trim()))throw Error('Paste a full 64-hex mainnet transaction hash.');
  const canonical=normalHash(hash);
  if(current.some(c=>c.hash===canonical))throw Error('This transaction is already tracked; it cannot be credited twice.');
  const n=current.filter(c=>c.chargeId===chargeId).length;
  if(n>=MAX_CLAIMS_PER_CHARGE)throw Error('This invoice already has the maximum 8 tracked transfers.');
  if(current.length>=MAX_CLAIMS_TOTAL)throw Error('The local proof inbox is full.');
  return parseProofClaims([...current,{chargeId,hash:canonical,recordedAt}]);
}
export function removeProofClaim(claims:ProofClaim[],chargeId:string,hash:string):ProofClaim[]{
  const existing=parseProofClaims(claims);
  return existing.filter(c=>!(c.chargeId===chargeId&&c.hash===normalHash(hash)));
}
export function claimsForCharge(claims:ProofClaim[],chargeId:string):ProofClaim[] {
  return claims.filter(c=>c.chargeId===chargeId);
}
export type ProofCheckMap=Record<string,VerifyResult | undefined>;
export interface LiveReconciliation {
  summary:Reconciliation;
  checked:number;
  verified:number;
  unresolved:number;
  rejected:number;
  report:'NODE_REPORTED'|'NEEDS_FRESH_RECHECK';
  details:{hash:string;state:'MATCHED'|'NOT_VERIFIED'|'REVIEW_REQUIRED'|'EXPIRED';amountLuna:number|null;message:string}[];
}
export const PROOF_FRESH_MS=5*60_000;

/** Live evidence ONLY — data restored from local storage is never a blockchain proof. */
export function reconcileClaimedCharge(
  charge:Charge,claims:ProofClaim[],checks:ProofCheckMap,submissions:Submission[]=[],
  nowMs=Date.now(),
):LiveReconciliation {
  const relevant=claimsForCharge(claims,charge.id);
  const evidence:TransferEvidence[]=[];
  let checked=0,verified=0,rejected=0,unresolved=0;
  const details:LiveReconciliation['details']=[];
  for(const claim of relevant){
    const x=checks[claim.hash];
    if(!x){unresolved++;details.push({hash:claim.hash,state:'NOT_VERIFIED',amountLuna:null,message:'Stored hash only. Recheck the mainnet node to assess this claim.'});continue;}
    const age=nowMs-Date.parse(x.observedAt);
    if(!Number.isFinite(age)||age< -120_000||age>PROOF_FRESH_MS){
      unresolved++;details.push({hash:claim.hash,state:'EXPIRED',amountLuna:null,message:'Previous node result is stale. Recheck before relying on it.'});continue;
    }
    checked++;
    if(x.state==='FINAL_MATCHED'&&x.network==='MainAlbatross'&&x.hash.toLowerCase()===claim.hash&&isSafeLuna(x.amountLuna ?? -1)){
      const amountLuna=x.amountLuna!;
      // Independently confirmed tuple and later macroblock have already been checked
      // by verifyNimTransaction (one untrusted public node, not contract settlement).
      evidence.push({network:'nimiq-mainnet',hash:claim.hash,recipient:charge.recipient,
        memo:charge.memo,amountLuna,status:'FINAL_VERIFIED'});
      verified++;
      details.push({hash:claim.hash,state:'MATCHED',amountLuna,message:'One public node reports exact matching canonical finality.'});
    }else{
      rejected++;details.push({hash:claim.hash,state:x.state==='REVIEW_REQUIRED'?'REVIEW_REQUIRED':'NOT_VERIFIED',
        amountLuna:null,message:x.message});
    }
  }
  const summary=projectCharge(charge,evidence,submissions);
  return {summary,checked,verified,rejected,unresolved,
    report:verified>0?'NODE_REPORTED':'NEEDS_FRESH_RECHECK',details};
}
export function loadProofClaims(storage:Pick<Storage,'getItem'>=localStorage):ProofClaim[]{
  try{
    const raw=storage.getItem(PROOF_STORAGE_KEY);
    return raw?parseProofClaims(JSON.parse(raw)):[];
  }catch{return [];} // A corrupt local cache is not a basis to credit rent.
}
export function saveProofClaims(claims:ProofClaim[],storage:Pick<Storage,'setItem'>=localStorage):void{
  storage.setItem(PROOF_STORAGE_KEY,JSON.stringify(parseProofClaims(claims)));
}
