import { parseNim, type Portfolio } from './domain.ts';
import { isValidNimiqAddress, formatNimiqAddress } from './address-validation.ts';
import type { VerifyInput } from './rpc.ts';

/** An audience is a presentation preference, NEVER an authenticated role. */
export type Audience='owner'|'tenant'|'explorer';
export type JourneyView='overview'|'properties'|'charges'|'collections'|'wallet';
export type JourneyAction='view'|'preview'|'instructions';

export interface JourneyStep{
  title:string;
  description:string;
  action:JourneyAction;
  label:string;
  view?:JourneyView;
  state:'READY'|'LOCAL_DONE'|'GUIDANCE_ONLY';
}

export function validAudience(x:unknown):x is Audience{
  return x==='owner'||x==='tenant'||x==='explorer';
}

/** A small pathway with honest completion: local setup is NOT proof of payment. */
export function journeySteps(audience:Audience,p:Portfolio,hasNodeMatch=false):JourneyStep[]{
  if(audience==='owner')return [
    {title:'Add your building and units',description:'One building or a whole portfolio. Labels stay on this device.',action:'view',view:'properties',label:'Add property',state:p.units.length?'LOCAL_DONE':'READY'},
    {title:'Create this month\'s rent request',description:'Pick the unit, month, amount in NIM and your receiving address. Each request gets a unique RR1 reference.',action:'view',view:'charges',label:'Create request',state:p.charges.length?'LOCAL_DONE':'READY'},
    {title:'Send the link to your tenant',description:'Your tenant opens it in Nimiq Pay and pays in one tap. No account needed.',action:'view',view:'charges',label:'Share a request',state:'READY'},
    {title:'See who has paid',description:'Payments are confirmed on Nimiq mainnet and your ledger updates: paid, partly paid or still due.',action:'view',view:'collections',label:'Review this month',state:hasNodeMatch?'LOCAL_DONE':'READY'},
  ];
  if(audience==='tenant')return [
    {title:'Open the link from your landlord',description:'It shows the month, the amount and who receives the rent.',action:'instructions',label:'How it works',state:'GUIDANCE_ONLY'},
    {title:'Pay with Nimiq Pay',description:'Approve the payment in your Nimiq Pay wallet. RentRail never holds your funds or keys.',action:'instructions',label:'Payment safety',state:'GUIDANCE_ONLY'},
    {title:'Get your on-chain proof',description:'RentRail confirms the transfer on Nimiq mainnet and gives you a proof link to send to your landlord.',action:'view',view:'wallet',label:'Check a payment',state:'READY'},
  ];
  return [
    {title:'Explore a sample portfolio',description:'Two buildings, three units, one rent already paid on-chain. Nothing is sent.',action:'preview',label:'Open sample',state:'READY'},
    {title:'See the monthly review',description:'Who paid, who partly paid and what is still due this month.',action:'view',view:'collections',label:'Monthly review',state:'READY'},
    {title:'Check a real payment',description:'Paste a Nimiq transaction and see it confirmed against a rent request on mainnet.',action:'view',view:'wallet',label:'Check payment',state:'READY'},
  ];
}

export interface ManualPaymentReviewFields{
  hash:string;
  recipient:string;
  memo:string;
  amountNim:string;
}
/** Read-only query parameters; never confer authority to pay, sign or credit a lease. */
export function parseManualPaymentReview(fields:ManualPaymentReviewFields):VerifyInput{
  const hash=fields.hash.trim().toLowerCase();
  if(!/^[a-f0-9]{64}$/.test(hash))throw Error('Paste a transaction hash of exactly 64 hexadecimal characters.');
  if(!isValidNimiqAddress(fields.recipient))throw Error('The recipient is not a valid Nimiq NQ address. Check the checksum.');
  const memo=fields.memo.trim();
  if(!/^RR1:[a-f0-9]{32}$/.test(memo))throw Error('Enter the exact RR1: reference from the rent request.');
  const amountLuna=parseNim(fields.amountNim);
  return {hash,recipient:formatNimiqAddress(fields.recipient),memo,amountLuna,allowPartial:true};
}

export const statusExplanations=[
  {title:'Awaiting payment',description:'The request exists for this unit and month. Nothing has been paid yet.'},
  {title:'Payment sent',description:'The tenant approved the payment in Nimiq Pay. RentRail is waiting for the network to confirm it.'},
  {title:'Paid ✓ confirmed on-chain',description:'Nimiq mainnet shows the exact amount, to the right address, with this month\'s reference, finalized.'},
  {title:'Needs review',description:'Partly paid, overpaid or not matching the request. Check it with your tenant.'},
] as const;

/** A node's reported transfer may be partial; never label it fully settled. */
export type ManualProofState='EXACT_NODE_MATCH'|'PARTIAL_NODE_MATCH'|'REVIEW_REQUIRED';
export function describeManualProof(expectedLuna:number,observedLuna:number|undefined,state:string):
  {kind:ManualProofState;remainingLuna:number|null;heading:string} {
  if(!Number.isSafeInteger(expectedLuna)||expectedLuna<=0)return {kind:'REVIEW_REQUIRED',remainingLuna:null,heading:'Invalid requested amount — review required'};
  if(state!=='FINAL_MATCHED'||typeof observedLuna!=='number'||!Number.isSafeInteger(observedLuna)||observedLuna<=0||observedLuna>expectedLuna)
    return {kind:'REVIEW_REQUIRED',remainingLuna:null,heading:'No verified match — review this payment'};
  if(observedLuna<expectedLuna)
    return {kind:'PARTIAL_NODE_MATCH',remainingLuna:expectedLuna-observedLuna,heading:'A partial transfer matched the request'};
  return {kind:'EXACT_NODE_MATCH',remainingLuna:0,heading:'An exact transfer matched the request'};
}
