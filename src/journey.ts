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
    {title:'Add your building',description:'Start with a name. Everything stays on this device.',action:'view',view:'properties',label:'Manage properties',state:p.properties.length?'LOCAL_DONE':'READY'},
    {title:'Add a rental unit',description:'Give each apartment a local label, not a tenant identity.',action:'view',view:'properties',label:'Manage units',state:p.units.length?'LOCAL_DONE':'READY'},
    {title:'Create a rent request',description:'Set the month, amount in NIM and confirmed receiving address.',action:'view',view:'charges',label:'Create rent request',state:p.charges.length?'LOCAL_DONE':'READY'},
    {title:'Review upcoming and overdue dates',description:'Local due dates help organize follow-ups; they do not prove legal arrears.',action:'view',view:'collections',label:'Open collections review',state:'READY'},
    {title:'Check a payment on-chain',description:'Only a matching, executed, final transaction can reduce session-level outstanding.',action:'view',view:'wallet',label:'Check a transaction',state:hasNodeMatch?'LOCAL_DONE':'READY'},
  ];
  if(audience==='tenant')return [
    {title:'Get a request link',description:'Your landlord shares a month-specific link. This demo cannot discover private invoices for you.',action:'instructions',label:'How request links work',state:'GUIDANCE_ONLY'},
    {title:'Check who receives the NIM',description:'Confirm the address with your landlord outside an editable link. A valid NQ checksum does not prove identity.',action:'instructions',label:'Recipient safety',state:'GUIDANCE_ONLY'},
    {title:'Pay only through an approved wallet flow',description:'This public demo never sends NIM. The old controlled mainnet pilot is closed.',action:'instructions',label:'Understand payment safety',state:'GUIDANCE_ONLY'},
    {title:'Verify an existing payment',description:'If you already paid, use the transaction hash, recipient, amount and reference for a read-only blockchain check.',action:'view',view:'wallet',label:'Verify my transaction',state:'READY'},
  ];
  return [
    {title:'Explore a realistic example',description:'See fictional properties and invoices without accounts, sending money or changing your saved portfolio.',action:'preview',label:'Explore sample workspace',state:'READY'},
    {title:'Understand the monthly workflow',description:'See which rent periods exist, what is expected and which records still need evidence.',action:'view',view:'collections',label:'View monthly review',state:'READY'},
    {title:'See independent verification',description:'Explore how Nimiq mainnet reports recipient, Luna amount, reference and later macroblock.',action:'view',view:'wallet',label:'Explore verification',state:'READY'},
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
  {title:'Requested',description:'A local amount and month were recorded. This does not prove a transfer happened.'},
  {title:'Sent / hash received',description:'A wallet may have returned a transaction reference; this alone does not confirm success.'},
  {title:'Matched on-chain',description:'One public mainnet node reported the correct recipient, amount, reference and a later finality block.'},
  {title:'Needs review',description:'The payment is missing, partial, mismatched or uncertain. Ask a human to investigate.'},
] as const;
