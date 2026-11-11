import './styles.css';
import {compareIndependentRecipient} from './recipient-crosscheck.ts';
import {illustrateRentNim} from './fiat-context.ts';
import { monthSnapshot, nextMonth, planNextPeriod } from './operations.ts';
import { journeySteps,validAudience,parseManualPaymentReview,describeManualProof,statusExplanations,type Audience,type ManualPaymentReviewFields } from './journey.ts';
import { collectionQueue,collectionCsv,reminderDraft,validDueDay,type DueDays } from './collections.ts';
import { isValidNimiqAddress, formatNimiqAddress } from './address-validation.ts';
import { createPaymentAudit, decodePaymentAudit, auditUrl, type PublicPaymentAudit } from './audit.ts';
import { verifyNimTransaction, findIncomingRentPayments, type VerifyResult } from './rpc.ts';
import { addProof, evidenceByCharge, parseProofs, removeProof, PROOF_STORAGE_KEY, type StoredProof } from './proof-store.ts';
import { payableAmountIssue } from './amount-rules.ts';
import { payRentRequest, payButtonLabel, PayError } from './payment.ts';
import {
  addCharge, addProperty, addUnit, createId, emptyPortfolio, formatNim, makeMemo,
  parseNim, projectCharge, recordSubmission, shareableRequest, validateSharedRequest, setChargeSignature, asciiJson,
  type Charge, type Portfolio, type SharedRequest, type ChargeViewStatus, type TransferEvidence,
} from './domain.ts';
import { loadPortfolio, savePortfolio } from './storage.ts';
import { explainHostError } from './host.ts';
import { getHostNetwork } from '@nimiq/mini-app-sdk';
import { createBackup, restoreBackup } from './backup.ts';
import { connectWallet, signWithWallet } from './wallet.ts';
import { verifySignedMessage, rentRequestMessage, paymentClaimMessage, sameAddress } from './signature.ts';
import { TENANT_KEY, emptyTenantMemory, entryFor, parseTenantMemory, recipientHistory, setPayment, upsertRequest, type TenantMemory } from './tenant-store.ts';
import qrcode from 'qrcode-generator';
import Identicons from '@nimiq/identicons';
import '@fontsource-variable/manrope';
import '@fontsource-variable/dm-sans';
import { addMonths, leaseMessage, leaseMonths, leaseRequest, leaseChargeId, requestMatchesLease, validateLease, publicLease, type Lease } from './lease.ts';

type View = 'overview' | 'properties' | 'charges' | 'collections' | 'wallet';
const root = document.querySelector<HTMLDivElement>('#app');
if (!root) throw new Error('Missing application mount element.');

let portfolio: Portfolio = loadPortfolio();
let preview = false;
let selectedView: View = 'overview';
const AUDIENCE_KEY='rentrail-workflow-preference-v1';
function storedAudience():Audience {
  try {const v=localStorage.getItem(AUDIENCE_KEY);return validAudience(v)?v:'explorer';}
  catch{return 'explorer';}
}
let audience:Audience=storedAudience();
let manualReviewFields:ManualPaymentReviewFields={hash:'',recipient:'',memo:'',amountNim:''};
let manualReviewBusy=false;
let manualReviewResult:VerifyResult|null=null;
let manualReviewMessage='';

let workspaceMonth = currentPeriod();
let collectionsPropertyFilter='';
function localDay():string {
  const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
const DUE_STORAGE_KEY='rentrail-due-settings-v1';
function readDueDays():DueDays {
  try {
    const raw=localStorage.getItem(DUE_STORAGE_KEY);if(!raw)return {};
    const parsed:unknown=JSON.parse(raw);
    if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))return {};
    const rows=Object.entries(parsed);
    if(rows.length>500 || rows.some(([id,day])=>!/^[a-f0-9]{32}$/.test(id)||!validDueDay(day)))return {};
    return Object.fromEntries(rows) as DueDays;
  }catch{return {};}
}
let dueDays=readDueDays();

// On-chain payment proofs for this device's ledger. Each one was matched on Nimiq
// mainnet (recipient, amount, RR1 reference, execution, finality) before being stored.
function loadProofs():StoredProof[]{
  try{return parseProofs(localStorage.getItem(PROOF_STORAGE_KEY));}catch{return [];}
}
let storedProofs=loadProofs();
function persistProofs(next:StoredProof[]):void{
  localStorage.setItem(PROOF_STORAGE_KEY,JSON.stringify(next)); // throws if storage is full: never claim it was saved
  storedProofs=next;
}
/** Records a FINAL_MATCHED result against one of this device's rent requests. */
function recordProof(chargeId:string,result:VerifyResult,payer?:string):'ADDED'|'ALREADY_RECORDED'|'USED_BY_OTHER_CHARGE'|'NOT_RECORDED'{
  if(preview||result.state!=='FINAL_MATCHED'||typeof result.amountLuna!=='number'||!portfolio.charges.some(c=>c.id===chargeId))return 'NOT_RECORDED';
  const {proofs,outcome}=addProof(storedProofs,{chargeId,hash:result.hash,amountLuna:result.amountLuna,verifiedAt:result.observedAt,...(payer?{payer:formatNimiqAddress(payer)}:{})});
  if(proofs!==storedProofs&&outcome!=='USED_BY_OTHER_CHARGE')persistProofs(proofs);
  return outcome;
}
function proofEvidence(p:Portfolio):Record<string,TransferEvidence[]>{
  if(preview)return demoEvidence(p);
  return evidenceByCharge(storedProofs,p.charges);
}
let recheckBusy=false;
let recheckMessage='';
let filterProperty = '';
let nextPeriodPreview: {period:string; count:number; skipped:number; next:string}|null=null;
let publicAudit: PublicPaymentAudit | null = null;
let publicAuditError = '';
let publicAuditBusy = false;
let publicAuditResult: VerifyResult | null = null;
let publicAuditRecorded = '';
let tenantHash = '';
let tenantVerifyBusy = false;
let tenantVerifyResult: VerifyResult | null = null;
// True when the page runs inside Nimiq Pay (the host injects its context before load).
const inNimiqPay = getHostNetwork()!==undefined || typeof (window as {nimiq?:unknown}).nimiq!=='undefined';
let txVerifyBusy = false;
let txVerifyResult: VerifyResult | null = null;
let txHashInput = '';
let txChargeId = '';
let txVerifiedChargeId = '';
let txRecordMessage = '';
let toast = '';
let tenantRequest: SharedRequest | null = null;
let tenantRecipientComparison='';
let tenantError = '';

// Tenant payment state. Requests and payments are remembered on the tenant's device
// (tenant-store) so the tenant sees their history and is never invited to pay twice.
type PayState='idle'|'paying'|'sent'|'confirmed'|'unknown';
let payState:PayState='idle';
let payMessage='';
let paidHash:string|null=null;
let confirmPolls=0;
let confirmTimer:ReturnType<typeof setTimeout>|null=null;
let unsignedAck=false;
let changedAddressAck=false;
let shareBusy=false;
let receiptResult:VerifyResult|null=null;

let tenantMemory:TenantMemory=(()=>{try{return parseTenantMemory(localStorage.getItem(TENANT_KEY));}catch{return emptyTenantMemory();}})();
function persistTenant(next:TenantMemory):void{tenantMemory=next;try{localStorage.setItem(TENANT_KEY,JSON.stringify(next));}catch{/* wallet history stays the source of truth */}}
function rememberPayment(id:string,state:'sent'|'confirmed'|'unknown',hash:string|null):void{
  const prior=entryFor(tenantMemory,id)?.payment;
  persistTenant(setPayment(tenantMemory,id,{state,hash,at:new Date().toISOString(),...(prior?.claim&&prior.hash===hash?{claim:prior.claim}:{})}));
}

// Landlord identity = their Nimiq Pay wallet, remembered on this device.
const LANDLORD_KEY='rentrail-landlord-v1';
let landlordWallet:string|null=(()=>{try{const v=JSON.parse(localStorage.getItem(LANDLORD_KEY)||'{}')?.wallet;return typeof v==='string'&&isValidNimiqAddress(v)?formatNimiqAddress(v):null;}catch{return null;}})();
function saveLandlordWallet(w:string|null):void{landlordWallet=w;try{localStorage.setItem(LANDLORD_KEY,JSON.stringify({wallet:w}));}catch{/* session only */}}
let walletBusy=false;
let syncBusy=false;
let syncMessage='';
let lastSyncAt:string|null=null;

// Tenant wallet per unit, learned from the first payment proof the tenant signs.
const UNIT_TENANTS_KEY='rentrail-unit-tenants-v1';
let unitTenants:Record<string,string>=(()=>{try{const d=JSON.parse(localStorage.getItem(UNIT_TENANTS_KEY)||'{}');return Object.fromEntries(Object.entries(d).filter(([k,v])=>/^[0-9a-f]{32}$/.test(k)&&typeof v==='string'&&isValidNimiqAddress(v))) as Record<string,string>;}catch{return {};}})();
function saveUnitTenants(next:Record<string,string>):void{localStorage.setItem(UNIT_TENANTS_KEY,JSON.stringify(next));unitTenants=next;}

// Monthly leases (landlord side). Each lease generates one rent request per month.
const LEASES_KEY='rentrail-leases-v1';
let leases:Lease[]=(()=>{try{const d=JSON.parse(localStorage.getItem(LEASES_KEY)||'[]');return Array.isArray(d)?d.flatMap(x=>{try{return [validateLease(x)];}catch{return [];}}).slice(0,500):[];}catch{return [];}})();
function saveLeases(next:Lease[]):void{localStorage.setItem(LEASES_KEY,JSON.stringify(next));leases=next;}
function leaseOfCharge(c:Charge):Lease|undefined{return leases.find(l=>l.unitId===c.unitId&&leaseChargeId(l.id,c.period)===c.id);}
/** Creates this month's (and any missed months') requests for every lease. */
function generateLeaseCharges():number{
  let next=portfolio,created=0;
  for(const l of leases){
    if(!l.unitId||!next.units.some(u=>u.id===l.unitId))continue;
    for(const period of leaseMonths(l,currentPeriod())){
      const r=leaseRequest(l,period);
      if(next.charges.some(c=>c.id===r.chargeId))continue;
      try{next=addCharge(next,{id:r.chargeId,unitId:l.unitId,period,amountLuna:l.amountLuna,recipient:l.recipient,memo:r.memo,createdAt:new Date().toISOString(),...(l.title?{title:l.title}:{})});created++;}
      catch{/* a manual request already exists for this unit and month */}
    }
  }
  if(created){savePortfolio(next);portfolio=next;}
  return created;
}
/** Tenant side: every month of a known lease up to now appears in My rent without a new link. */
function refreshTenantLeaseMonths():void{
  const seen=new Map<string,Lease>();
  for(const e of tenantMemory.entries)if(e.request.lease&&requestMatchesLease(e.request))seen.set(e.request.lease.id,e.request.lease);
  let m=tenantMemory;const now=new Date().toISOString();
  for(const l of seen.values())for(const period of leaseMonths(l,currentPeriod()))m=upsertRequest(m,leaseRequest(l,period),now);
  if(m!==tenantMemory)persistTenant(m);
}

const search = new URLSearchParams(window.location.search);
if (search.has('audit')) {
  try {publicAudit = decodePaymentAudit(search.get('audit') || '');}
  catch(error){publicAuditError=error instanceof Error?error.message:'Invalid verification link.';}
} else if (search.has('pay')) {
  try {
    tenantRequest = decodeRequest(search.get('pay') || '');
    persistTenant(upsertRequest(tenantMemory,tenantRequest,new Date().toISOString()));
    refreshTenantLeaseMonths();
    const prior=entryFor(tenantMemory,tenantRequest.chargeId)?.payment;
    if(prior&&(prior.state==='sent'||prior.state==='confirmed')&&prior.hash){paidHash=prior.hash;tenantHash=prior.hash;payState=prior.state;}
    else if(prior?.state==='unknown')payState='unknown';
    try{localStorage.setItem(AUDIENCE_KEY,'tenant');}catch{/* preference only */}
    audience='tenant';
  }
  catch (error) { tenantError = error instanceof Error ? error.message : 'Invalid link.'; }
}

function randomId(): string {
  if (typeof crypto?.getRandomValues !== 'function') throw new Error('Secure random values unavailable; open the app over HTTPS.');
  return createId(crypto.getRandomValues(new Uint8Array(16)));
}
function escapeHtml(input: unknown): string {
  return String(input ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] || ch);
}
function normalizeLabel(label: string): string { return escapeHtml(label); }
function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}
const DEMO_UNITS=[
  {id:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',prop:0,label:'Apt 101',rent:'1250',tenant:'NQ46 YCNN 4H64 DNDL GFDD VU50 YPJC MATF 7A3H'},
  {id:'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',prop:0,label:'Apt 102',rent:'980',tenant:'NQ16 M476 C8PX 1MN5 4XV4 67LM 3KM7 VYM7 1RTY'},
  {id:'cccccccccccccccccccccccccccccccc',prop:1,label:'Studio 3',rent:'640',tenant:'NQ03 R18B KE0M 6B2P 9477 HTNL FART RETC A9ES'},
];
function demoPortfolio(): Portfolio {
  const now = new Date().toISOString();
  let p = emptyPortfolio();
  p = addProperty(p, { id:'11111111111111111111111111111111', name:'Cedar House', createdAt:now });
  p = addProperty(p, { id:'22222222222222222222222222222222', name:'Riverside', createdAt:now });
  for (const u of DEMO_UNITS) p = addUnit(p, { id:u.id, propertyId:p.properties[u.prop].id, label:u.label });
  const months=[-3,-2,-1,0].map(n=>addMonths(currentPeriod(),n));
  for (const [i,u] of DEMO_UNITS.entries()) for (const [m,period] of months.entries()) {
    const id = (String(i+1)+String(m+1)).repeat(16);
    p = addCharge(p, { id, unitId:u.id, period, amountLuna:parseNim(u.rent), recipient:'NQ07 0000 0000 0000 0000 0000 0000 0000 0000', memo:makeMemo(id), createdAt:now, title:`${p.properties[u.prop].name} · ${u.label}` });
  }
  return p;
}
/** Sample payments: everything paid except Apt 102 this month (late) and Studio 3 (half paid). */
function demoEvidence(p:Portfolio):Record<string,TransferEvidence[]>{
  const out:Record<string,TransferEvidence[]>={};
  const now=currentPeriod();
  for(const c of p.charges){
    let amount=c.amountLuna;
    if(c.period===now&&c.unitId===DEMO_UNITS[1].id)continue;
    if(c.period===now&&c.unitId===DEMO_UNITS[2].id)amount=Math.floor(amount/2/1000)*1000;
    out[c.id]=[{network:'nimiq-mainnet',hash:c.id+c.id,recipient:c.recipient,memo:c.memo,amountLuna:amount,status:'FINAL_VERIFIED'}];
  }
  return out;
}
function activePortfolio(): Portfolio { return preview ? demoPortfolio() : portfolio; }
function safePersist(update: Portfolio): void {
  if (preview) throw new Error('Exit example preview before creating your own records.');
  savePortfolio(update);
  portfolio = update;
  render();
}
function statusText(status: ChargeViewStatus): string {
  return ({ OPEN:'Awaiting payment', SUBMITTED_UNVERIFIED:'Payment sent', PARTIALLY_FUNDED:'Partly paid', PAID_ONCHAIN_VERIFIED:'Paid ✓ on-chain', REVIEW_REQUIRED:'Needs review' })[status];
}
function statusClass(status: ChargeViewStatus): string {
  return ({OPEN:'neutral',SUBMITTED_UNVERIFIED:'amber',PARTIALLY_FUNDED:'amber',PAID_ONCHAIN_VERIFIED:'green',REVIEW_REQUIRED:'red'})[status];
}
function icon(name: string): string {
  const paths: Record<string,string> = {
    'home':'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
    'building':'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 7h1m4 0h1M9 11h1m4 0h1M9 15h1m4 0h1M10 21v-3h4v3"/>',
    'receipt':'<path d="M6 2h12v20l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3"/>',
    'wallet':'<rect x="3" y="6" width="18" height="15" rx="3"/><path d="M6 6V4a2 2 0 0 1 2-2h10M16 14h5"/>',
    'arrow':'<path d="M5 12h14m-7-7 7 7-7 7"/>',
    'plus':'<path d="M12 5v14M5 12h14"/>',
    'check':'<path d="m5 12 4 4L19 6"/>',
    'shield':'<path d="m12 2 9 4v6c0 6-4 9-9 10-5-1-9-4-9-10V6z"/><path d="m8 12 3 3 5-6"/>',
    'clock':'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/>',
    'calendar-clock':'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/><circle cx="12" cy="16" r="3"/><path d="M12 14.5V16l1.5 1"/>',
    'link':'<path d="M10 13a5 5 0 0 0 7 .3l3-3a5 5 0 1 0-7-7l-2 2M14 11a5 5 0 0 0-7-.3l-3 3a5 5 0 1 0 7 7l2-2"/>',
    'alert':'<path d="M12 3 2 21h20L12 3z"/><path d="M12 9v5M12 17h.01"/>',
    'layers':'<path d="m12 2 10 5-10 5L2 7zM2 12l10 5 10-5M2 17l10 5 10-5"/>',
  };
  return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||paths.home}</svg>`;
}
function navButton(view: View, label: string, glyph: string): string {
  return `<button class="nav-item ${selectedView===view?'active':''}" data-nav="${view}" type="button">${icon(glyph)}<span>${label}</span></button>`;
}
function walletIndicator(): string {
  const me=tenantRequest||audience==='tenant'?(tenantMemory.wallet??null):landlordWallet;
  if(me)return `<div class="wallet-state"><span class="status-light online"></span><span class="mono">${escapeHtml(shortAddress(me))}</span></div>`;
  return `<div class="wallet-state"><span class="status-light ${inNimiqPay?'online':''}"></span><span>${inNimiqPay?'In Nimiq Pay':'Open in Nimiq Pay'}</span></div>`;
}
function shortAddress(a:string):string{const c=a.replace(/\s+/g,'');return c.slice(0,4)+' '+c.slice(4,8)+' … '+c.slice(-4);}
function identityPanel():string{
  if(landlordWallet)return `<section class="identity-card" aria-label="Your Nimiq Pay wallet">${identiconImg(landlordWallet,44)}<div><small>Signed in with Nimiq Pay</small><strong class="mono">${escapeHtml(shortAddress(landlordWallet))}</strong><span>Rent is paid to this wallet. Every request you send is signed by it.</span></div><button id="disconnect-wallet" class="tertiary" type="button">Change</button></section>`;
  return `<section class="identity-card connect" aria-label="Connect Nimiq Pay"><div class="identity-icon">${icon('wallet')}</div><div><small>No account, no password</small><strong>Sign in with Nimiq Pay</strong><span>Your wallet is your account. Rent goes straight to it, and tenants can verify every request comes from you.</span></div><button id="connect-wallet" class="primary" type="button" ${walletBusy?'disabled':''}>${walletBusy?'Connecting…':'Connect'}</button></section>`;
}
/** Nimiq identicon for an address: the same picture Nimiq Pay shows for it. */
const identiconCache=new Map<string,string>();
function identiconImg(address:string,size=40):string{
  const key=isValidNimiqAddress(address)?formatNimiqAddress(address):address;
  const src=identiconCache.get(key);
  return `<img class="identicon" width="${size}" height="${size}" alt="" data-identicon="${escapeHtml(key)}" ${src?`src="${src}"`:''}/>`;
}
function hydrateIdenticons():void{
  root!.querySelectorAll<HTMLImageElement>('img[data-identicon]:not([src])').forEach(img=>{
    const key=img.dataset.identicon||'';
    void Identicons.toDataUrl(key).then((url:string)=>{identiconCache.set(key,url);img.src=url;}).catch(()=>{/* keep the empty frame */});
  });
}
type RailState='paid'|'partial'|'due'|'late'|'review'|'none';
/** The rent rail: one station per month, filled when the rent is confirmed on-chain. */
function rentRail(items:{period:string;state:RailState;label?:string}[],compact=false):string{
  const name:Record<RailState,string>={paid:'Paid',partial:'Partly paid',due:'Due',late:'Late',review:'Needs review',none:'No request'};
  return `<ol class="rail ${compact?'compact':''}" aria-label="Rent by month">${items.map(i=>`<li class="station st-${i.state}" title="${escapeHtml(monthLabel(i.period))}: ${name[i.state]}"><span class="dot">${i.state==='paid'?'✓':i.state==='late'?'!':''}</span>${compact?'':`<small>${escapeHtml(shortMonth(i.period))}</small>`}</li>`).join('')}</ol>`;
}
function shortMonth(period:string):string{
  const [y,m]=period.split('-').map(Number);
  try{return new Date(Date.UTC(y,m-1,1)).toLocaleString('en',{month:'short',timeZone:'UTC'});}catch{return period.slice(5);}
}
function chargeRailState(p:Portfolio,c:Charge,evidence:Record<string,TransferEvidence[]>):RailState{
  const pr=projectCharge(c,evidence[c.id]??[],p.submissions);
  if(pr.status==='PAID_ONCHAIN_VERIFIED')return 'paid';
  if(pr.status==='PARTIALLY_FUNDED')return 'partial';
  if(pr.status==='REVIEW_REQUIRED')return 'review';
  const due=`${c.period}-${String(dueDays[c.unitId]??1).padStart(2,'0')}`;
  return localDay()>due?'late':'due';
}
function unitBoard(p:Portfolio,evidence:Record<string,TransferEvidence[]>):string{
  const months=[-3,-2,-1,0].map(n=>addMonths(workspaceMonth,n));
  const rows=p.units.map(u=>{
    const prop=p.properties.find(x=>x.id===u.propertyId);
    const items=months.map(period=>{const c=p.charges.find(x=>x.unitId===u.id&&x.period===period);return {period,state:c?chargeRailState(p,c,evidence):'none' as RailState};});
    const cur=p.charges.find(x=>x.unitId===u.id&&x.period===workspaceMonth);
    const pr=cur?projectCharge(cur,evidence[cur.id]??[],p.submissions):null;
    const state=items[items.length-1].state;
    const tenant=preview?DEMO_UNITS.find(x=>x.id===u.id)?.tenant:unitTenants[u.id];
    const right=!cur?'<span class="unit-amount muted">No request</span>':`<span class="unit-amount">${formatNim(cur.amountLuna)} <small>NIM</small></span><span class="tag ${state==='paid'?'green':state==='late'||state==='review'?'red':'amber'}">${state==='paid'?'Paid ✓':state==='partial'?`${formatNim(pr!.dueLuna)} left`:state==='late'?'Late':state==='review'?'Review':'Due'}</span>`;
    return `<li class="unit-line">${tenant?identiconImg(tenant,38):`<span class="unit-initial">${escapeHtml(u.label.slice(0,2).toUpperCase())}</span>`}<div class="unit-main"><strong>${normalizeLabel(u.label)}</strong><small>${normalizeLabel(prop?.name||'')}</small>${rentRail(items)}</div><div class="unit-side">${right}</div></li>`;
  }).join('');
  return `<section class="board" aria-label="Units this month"><div class="section-heading"><div><div class="eyebrow">YOUR UNITS</div><h2>Rent by unit</h2></div><button class="tertiary" data-nav="charges" type="button">Requests ${icon('arrow')}</button></div><ul class="unit-list">${rows}</ul></section>`;
}
function monthHero(p:Portfolio,evidence:Record<string,TransferEvidence[]>):string{
  const snap=monthSnapshot(p,workspaceMonth,'',evidence);
  const pct=snap.expectedLuna?Math.min(100,Math.round(snap.paidLuna/snap.expectedLuna*100)):0;
  const late=snap.lines.filter(l=>chargeRailState(p,l.charge,evidence)==='late').length;
  return `<section class="month-hero" aria-label="This month">
    <div class="month-hero-top"><div><div class="eyebrow">${escapeHtml(monthLabel(workspaceMonth).toUpperCase())}</div><h1>${formatNim(snap.paidLuna)} <span>of ${formatNim(snap.expectedLuna)} NIM collected</span></h1></div>
      <div class="ring" style="--pct:${pct}"><span>${pct}%</span></div></div>
    <div class="progress"><span style="width:${pct}%"></span></div>
    <div class="month-hero-stats"><span><b>${snap.paidCount}</b> paid</span><span><b>${snap.charges-snap.paidCount}</b> open</span><span class="${late?'late':''}"><b>${late}</b> late</span><span><b>${formatNim(snap.outstandingLuna)}</b> NIM due</span></div>
    ${preview?'':syncBar()}
  </section>`;
}
function activityFeed(p:Portfolio):string{
  const items=(preview?p.charges.filter(c=>demoEvidence(p)[c.id]).sort((a,b)=>b.period.localeCompare(a.period)).slice(0,4).map(c=>({c,amount:demoEvidence(p)[c.id][0].amountLuna,at:'',payer:DEMO_UNITS.find(u=>u.id===c.unitId)?.tenant})):
    storedProofs.slice().sort((a,b)=>b.verifiedAt.localeCompare(a.verifiedAt)).slice(0,5).flatMap(x=>{const c=p.charges.find(y=>y.id===x.chargeId);return c?[{c,amount:x.amountLuna,at:x.verifiedAt,payer:x.payer}]:[];}));
  if(!items.length)return '';
  return `<section class="section" aria-label="Latest payments"><div class="section-heading"><div><div class="eyebrow">ON-CHAIN</div><h2>Latest payments</h2></div></div><ul class="feed">${items.map(({c,amount,at,payer})=>{const u=p.units.find(x=>x.id===c.unitId);return `<li>${payer?identiconImg(payer,32):`<span class="unit-initial small">${icon('check')}</span>`}<div><strong>${normalizeLabel(u?.label||'')} · ${escapeHtml(shortMonth(c.period))}</strong><small>${at?escapeHtml(at.slice(0,10)):'Confirmed'} · finalized on Nimiq</small></div><b>+${formatNim(amount)} NIM</b></li>`;}).join('')}</ul></section>`;
}
function audienceNavigation():string{
  const tabs: Array<{id:Audience,label:string,detail:string}> = [
    {id:'owner',label:'I manage rentals',detail:'Request rent and see who paid'},
    {id:'tenant',label:'I pay rent',detail:'Pay a request from my landlord'},
    {id:'explorer',label:'Show me RentRail',detail:'Open a sample portfolio'}
  ];
  return `<div class="journey-audiences" role="group" aria-label="Choose what you want to do">${tabs.map(t=>
    `<button class="journey-audience ${audience===t.id?'active':''}" data-audience="${t.id}" type="button" aria-pressed="${audience===t.id}"><strong>${escapeHtml(t.label)}</strong><span>${escapeHtml(t.detail)}</span></button>`).join('')}</div>`;
}
function statusGuide():string{
  return `<section class="status-guide section" aria-label="What each rent status means">
    <div class="section-heading"><div><div class="eyebrow">CLEAR STATUSES</div><h2>What each status means</h2></div></div>
    <div class="status-guide-grid">${statusExplanations.map((state,i)=>`<article class="status-stage">
      <span class="status-stage-index">${i+1}</span><h3>${escapeHtml(state.title)}</h3><p>${escapeHtml(state.description)}</p></article>`).join('')}</div>
  </section>`;
}
function guidedJourney(p:Portfolio):string{
  const verified=storedProofs.length>0;
  const steps=journeySteps(audience,preview?emptyPortfolio():p,verified);
  const headline=audience==='owner'?'Collect rent in NIM, month after month.':audience==='tenant'?'Pay your rent in one tap.':'See RentRail in 30 seconds.';
  const explainer=audience==='owner'
    ?'Create a request per unit and month, send the link, and see each payment confirmed on Nimiq mainnet.'
    :audience==='tenant'
      ?'Open the link your landlord sent you inside Nimiq Pay, check the details, and pay. You get an on-chain proof.'
      :'Explore a sample portfolio, then try the real flow with your own Nimiq Pay wallet.';
  return `<section class="journey-shell" aria-label="Choose your RentRail pathway">
    <div class="journey-head"><div><div class="eyebrow">HOW IT WORKS</div><h2>${escapeHtml(headline)}</h2><p>${escapeHtml(explainer)}</p></div><span class="journey-pill">NON-CUSTODIAL</span></div>
    ${audienceNavigation()}
    <ol class="journey-steps">${steps.map((step,i)=>`<li class="journey-step">
      <span class="journey-number">${step.state==='LOCAL_DONE'?'✓':i+1}</span>
      <div class="journey-step-copy"><strong>${escapeHtml(step.title)}</strong><p>${escapeHtml(step.description)}</p></div>
      <button class="journey-step-action" type="button" data-journey="${i}">${escapeHtml(step.label)} ${icon('arrow')}</button>
      </li>`).join('')}</ol>
    ${audience==='tenant'?'<div id="tenant-help" class="tenant-help"><strong>For tenants</strong><p>Your landlord sends you a RentRail link for each month. Open it in Nimiq Pay → Mini Apps, check the amount and the receiving address, then tap Pay. Nimiq Pay asks you to confirm; RentRail never touches your funds. Already paid from another wallet? Use Check payment with your transaction hash.</p></div>':''}
  </section>`;
}
function overview(p: Portfolio): string {
  if(audience==='tenant')return tenantHome();
  const evidence=proofEvidence(p);
  const empty=!p.units.length;
  if(empty&&!preview)return `<section class="landing">
      <div class="landing-hero"><div class="eyebrow">RENT ON NIMIQ PAY</div><h1>Rent that pays itself <em>in.</em></h1><p>Sign a lease once with your Nimiq Pay wallet. Each month your tenant pays in one tap, and RentRail confirms it on Nimiq mainnet.</p>
      ${rentRail([-3,-2,-1,0,1].map(n=>({period:addMonths(currentPeriod(),n),state:(n<0?'paid':n===0?'due':'none') as RailState})))}
      <div class="landing-ctas"><button id="preview-demo" class="secondary" type="button">See a sample portfolio ${icon('arrow')}</button><button class="ghost" type="button" data-audience="tenant">I pay rent</button></div></div>
      ${identityPanel()}
      <ol class="how">${[['Connect','Sign in with your Nimiq Pay wallet. No account.'],['Sign a lease','Rent, due day, first month. Signed once.'],['Get paid','Tenants pay in one tap. Payments appear by themselves.']].map(([t,d],i)=>`<li><span>${i+1}</span><div><strong>${t}</strong><p>${d}</p></div></li>`).join('')}</ol>
    </section>${whyNimiq()}`;
  return `${preview?'':identityPanel()}
    ${monthHero(p,evidence)}
    ${unitBoard(p,evidence)}
    ${activityFeed(p)}
    <details class="panel details-panel"><summary>What the statuses mean</summary>${statusGuide()}</details>
    ${whyNimiq()}`;
}
function tenantHome():string{
  const entries=tenantMemory.entries.slice().sort((a,b)=>a.request.period.localeCompare(b.request.period));
  const next=entries.find(e=>e.payment?.state!=='confirmed');
  const nextCard=next?(()=>{const u=new URL(window.location.pathname,window.location.origin);u.searchParams.set('pay',encodeRequest(next.request));return `<a class="next-rent" href="${escapeHtml(u.toString())}">${identiconImg(next.request.recipient,48)}<div><small>${next.payment?.state==='sent'?'CONFIRMING':'NEXT RENT'}</small><strong>${formatNim(next.request.amountLuna)} NIM</strong><span>${escapeHtml(monthLabel(next.request.period))}${next.request.title?` · ${escapeHtml(next.request.title)}`:''}</span></div><span class="next-go">${next.payment?.state==='sent'?'View':'Pay'} ${icon('arrow')}</span></a>`;})():'';
  const leases=new Map<string,typeof entries>();
  for(const e of entries)if(e.request.lease){const k=e.request.lease.id;leases.set(k,[...(leases.get(k)??[]),e]);}
  const rails=[...leases.values()].map(list=>`<div class="tenant-rail"><strong>${escapeHtml(list[0].request.title||'Monthly rent')}</strong>${rentRail(list.slice(-6).map(e=>({period:e.request.period,state:(e.payment?.state==='confirmed'?'paid':e.request.period<currentPeriod()?'late':'due') as RailState})))}</div>`).join('');
  return `<section class="landing tenant-landing"><div class="landing-hero"><div class="eyebrow">MY RENT</div><h1>${next?'Your next rent.':entries.length?'All paid. <em>Nice.</em>':'Pay rent in <em>one tap.</em>'}</h1><p>${entries.length?'Every month, signed by your landlord and confirmed on Nimiq.':'Open the link your landlord sends you, inside Nimiq Pay. It stays here, month after month.'}</p></div>
    ${nextCard}${rails}</section>
    ${myRentPanel()}
    ${whyNimiq()}`;
}
function whyNimiq():string{
  const items=[
    ['wallet','Your wallet is your account','No sign-up, email or password. Landlords and tenants are their Nimiq Pay wallets.'],
    ['shield','Signed requests','Every request is signed by the landlord\'s wallet. A changed address or amount blocks payment.'],
    ['receipt','The reference rides on-chain','The RR1 code travels inside the Nimiq transaction, so each payment finds its unit and month.'],
    ['check','Native approval, fast finality','Tenants approve in the Nimiq Pay sheet. Final in about a minute, for a fraction of a cent.'],
  ];
  return `<section class="why-nimiq section" aria-label="Why Nimiq Pay"><div class="section-heading"><div><div class="eyebrow">BUILT ON NIMIQ PAY</div><h2>Why this only works here</h2></div></div>
    <div class="why-grid">${items.map(([i,t,d])=>`<article><span>${icon(i)}</span><h3>${escapeHtml(t)}</h3><p>${escapeHtml(d)}</p></article>`).join('')}</div></section>`;
}
function myRentPanel():string{
  const entries=tenantMemory.entries.slice().sort((a,b)=>b.request.period.localeCompare(a.request.period));
  const rows=entries.map(e=>{
    const st=e.payment?.state;
    const tag=st==='confirmed'?'<span class="tag green">Paid ✓</span>':st==='sent'?'<span class="tag amber">Confirming</span>':st==='unknown'?'<span class="tag red">Check wallet</span>':'<span class="tag neutral">To pay</span>';
    const url=new URL(window.location.pathname,window.location.origin);url.searchParams.set('pay',encodeRequest(e.request));
    return `<a class="charge-row" href="${escapeHtml(url.toString())}"><div class="charge-avatar">${icon(e.request.lease?'calendar-clock':'home')}</div><div class="charge-title"><b>${escapeHtml(e.request.title||'Rent')}</b><span>${escapeHtml(monthLabel(e.request.period))}</span></div><div class="charge-amount"><strong>${formatNim(e.request.amountLuna)} NIM</strong>${tag}</div></a>`;
  }).join('');
  return `<section class="section" aria-label="My rent"><div class="section-heading"><div><div class="eyebrow">ON THIS DEVICE</div><h2>My rent</h2></div>${tenantMemory.wallet?`<span class="count mono">${escapeHtml(shortAddress(tenantMemory.wallet))}</span>`:''}</div>
    ${rows||'<div class="empty"><h3>No rent requests yet</h3><p>Open the link your landlord sends you in Nimiq Pay. With a monthly lease, each new month appears here by itself.</p></div>'}
  </section>`;
}
function periodCockpit(p:Portfolio):string {
  const activeFilter=p.properties.some(x=>x.id===filterProperty)?filterProperty:'';
  const snap=monthSnapshot(p,workspaceMonth,activeFilter,proofEvidence(p));
  const options=p.properties.map(x=>`<option value="${escapeHtml(x.id)}" ${activeFilter===x.id?'selected':''}>${escapeHtml(x.name)}</option>`).join('');
  const monthlyLines=snap.lines.slice(0,8).map(line=>`<div class="period-line">
    <div><strong>${escapeHtml(line.unitLabel)}</strong><small>${escapeHtml(line.propertyName)}</small></div>
    <div><strong>${line.status==='PAID_ONCHAIN_VERIFIED'?formatNim(line.charge.amountLuna):formatNim(line.outstandingLuna)} NIM</strong><span class="tag ${statusClass(line.status)}">${statusText(line.status)}</span></div></div>`).join('');
  return `<section class="period-cockpit" aria-label="This month">
    <div class="section-heading"><div><div class="eyebrow">THIS MONTH</div><h2>Who has paid?</h2></div></div>
    <div class="period-filters"><label>Month<input id="month-filter" type="month" value="${escapeHtml(workspaceMonth)}"/></label>
    <label>Property<select id="property-filter"><option value="">All properties</option>${options}</select></label></div>
    <div class="period-metrics">
      <div><small>Requested</small><strong>${formatNim(snap.expectedLuna)} NIM</strong></div>
      <div><small>Still due</small><strong>${formatNim(snap.outstandingLuna)} NIM</strong></div>
      <div><small>Units without a request</small><strong>${snap.unitsWithoutCharge} / ${snap.activeUnits}</strong></div>
      <div><small>Paid on-chain</small><strong>${snap.paidCount} / ${snap.charges}</strong></div>
    </div>
    <div class="period-lines">${monthlyLines||'<div class="empty-period">No rent requests for this month yet.</div>'}</div>
    ${syncBar()}
    <div class="period-actions"><button class="tertiary" data-nav="charges" type="button">Manage this month ${icon('arrow')}</button></div>
  </section>`;
}
function syncBar():string{
  if(preview)return '';
  return `<div class="sync-bar" role="status"><span>${syncBusy?'<span class="spinner" aria-hidden="true"></span> Looking for rent payments on Nimiq mainnet…':escapeHtml(syncMessage||(lastSyncAt?'Up to date.':'Payments to your address are detected automatically.'))}</span><button id="sync-payments" class="tertiary" type="button" ${syncBusy||!portfolio.charges.length?'disabled':''}>Sync payments</button></div>`;
}
function leasePanel(p:Portfolio):string{
  const rows=leases.filter(l=>l.unitId&&p.units.some(u=>u.id===l.unitId)).map(l=>{
    const u=p.units.find(x=>x.id===l.unitId)!;const pr=p.properties.find(x=>x.id===u.propertyId);
    const signed=!!l.sig&&verifySignedMessage(leaseMessage(l),l.sig).valid;
    return `<div class="collection-row"><div><strong>${escapeHtml(pr?.name||'')} · ${escapeHtml(u.label)}</strong><small>${formatNim(l.amountLuna)} NIM / month · due day ${l.dueDay} · since ${escapeHtml(l.start)} · ${signed?'✓ signed':'unsigned'}</small></div><div class="row-actions">${signed||preview?'':`<button type="button" class="tertiary" data-sign-lease="${escapeHtml(l.id)}">Sign</button>`}<button type="button" class="tertiary" data-share-lease="${escapeHtml(l.id)}">Send lease link</button><button type="button" class="tertiary danger-text" data-end-lease="${escapeHtml(l.id)}">End</button></div></div>`;
  }).join('');
  return `<section class="panel lease-panel" aria-label="Monthly leases"><div class="section-heading"><div><div class="eyebrow">RECURRING</div><h2>Monthly leases</h2></div><span class="count">${leases.length}</span></div>
    <p class="form-hint">Sign a lease once. RentRail creates the request every month, your tenant sees the next rent in Nimiq Pay without a new link, and payments are detected automatically.</p>
    <form id="lease-form" class="form-stack">
      <label>Unit<select name="unitId" required>${p.units.filter(u=>!leases.some(l=>l.unitId===u.id)).map(u=>`<option value="${escapeHtml(u.id)}">${normalizeLabel(p.properties.find(b=>b.id===u.propertyId)?.name||'')} / ${normalizeLabel(u.label)}</option>`).join('')}</select></label>
      <div class="form-duo"><label>Monthly rent (NIM)<input name="amount" inputmode="decimal" placeholder="1250.00" required/></label><label>Due day<input name="dueDay" type="number" min="1" max="28" value="1" required/></label></div>
      <label>First month<input name="start" type="month" value="${currentPeriod()}" required/></label>
      <button class="primary" type="submit" ${preview||!landlordWallet||!p.units.some(u=>!leases.some(l=>l.unitId===u.id))?'disabled':''}>${icon('calendar-clock')} ${inNimiqPay?'Create and sign lease':'Create lease'}</button>
      ${landlordWallet?'':'<p class="form-hint">Connect Nimiq Pay on the Overview page first: the lease pays your wallet and is signed by it.</p>'}
    </form>
    <div class="collection-list">${rows}</div>
  </section>`;
}
function renewalPlanner(p:Portfolio):string {
  const source=p.charges.filter(c=>c.period===workspaceMonth&&!leaseOfCharge(c));
  const next=nextMonth(workspaceMonth);
  const eligible=source.filter(c=>!p.charges.some(x=>x.unitId===c.unitId&&x.period===next));
  const matches=nextPeriodPreview?.period===workspaceMonth && nextPeriodPreview.count===eligible.length;
  return `${leasePanel(p)}<details class="panel details-panel renewal-panel" aria-label="Next-month planner"><summary>One-off requests: copy this month to next month</summary>
    <p class="form-hint">Copy every ${escapeHtml(workspaceMonth)} request that is not part of a lease into ${escapeHtml(next)}. Each new request gets a new RR1 reference.</p>
    <div class="period-filters"><label>Source month<input id="renewal-month" type="month" value="${escapeHtml(workspaceMonth)}"/></label></div>
    <div class="renewal-stats"><strong>${eligible.length}</strong> request${eligible.length===1?'':'s'} to create · ${source.length-eligible.length} already exist for ${escapeHtml(next)}</div>
    <div class="renewal-actions">
      <button id="preview-renewal" class="tertiary" type="button" ${preview||eligible.length===0?'disabled':''}>Preview</button>
      ${matches?`<button id="confirm-renewal" class="primary" type="button" ${preview?'disabled':''}>Create ${eligible.length} request${eligible.length===1?'':'s'} ${icon('arrow')}</button>`:''}
    </div>
  </details>`;
}
function emptyState(title:string, description:string, goto:View, action:string):string {
  return `<div class="empty"><div class="empty-icon">${icon('building')}</div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(description)}</p><button class="primary" type="button" data-nav="${goto}">${escapeHtml(action)} ${icon('arrow')}</button></div>`;
}
function requestForCharge(c:Charge):SharedRequest{
  const lease=leaseOfCharge(c);
  return lease?leaseRequest(lease,c.period):shareableRequest(c);
}
function chargeSigned(c:Charge):boolean{
  const lease=leaseOfCharge(c);
  if(lease)return !!lease.sig&&verifySignedMessage(leaseMessage(lease),lease.sig).valid;
  return !!c.sig&&verifySignedMessage(rentRequestMessage(c),c.sig).valid;
}
function chargeRow(p:Portfolio,c:Charge,evidence:Record<string,TransferEvidence[]>=proofEvidence(p)):string {
  const unit = p.units.find(u=>u.id===c.unitId);
  const property = p.properties.find(b=>b.id===unit?.propertyId);
  const calculated=projectCharge(c,evidence[c.id]??[],p.submissions);
  const due=calculated.status==='PARTIALLY_FUNDED'?`<small class="due-note">${formatNim(calculated.dueLuna)} NIM left</small>`:'';
  const lease=leaseOfCharge(c);
  const sign=preview?'':chargeSigned(c)?`<span class="sig-badge" title="Signed with your Nimiq Pay wallet">✓ ${lease?'Lease':'Signed'}</span>`:lease?'<span class="sig-badge warn">Lease unsigned</span>':`<button class="tiny warn" type="button" data-sign="${escapeHtml(c.id)}">${icon('shield')}<span> Sign</span></button>`;
  return `<div class="charge-row"><div class="charge-avatar">${icon(lease?'calendar-clock':'home')}</div><div class="charge-title"><b>${normalizeLabel(unit?.label||'Unknown unit')}</b><span>${normalizeLabel(property?.name||'Unknown property')} · ${escapeHtml(c.period)}</span></div><div class="charge-amount"><strong>${formatNim(c.amountLuna)} NIM</strong><span class="tag ${statusClass(calculated.status)}">${statusText(calculated.status)}</span>${due}</div>${sign}<button class="tiny" type="button" data-share="${escapeHtml(c.id)}" ${preview?'disabled title="Sample data cannot be shared"':''}>${icon('link')}<span> Send</span></button></div>`;
}
function propertiesView(p:Portfolio):string {
  const cards=p.properties.map(property=>{
    const units=p.units.filter(u=>u.propertyId===property.id);
    return `<div class="property-card"><div class="property-head"><span class="property-icon">${icon('building')}</span><div><strong>${normalizeLabel(property.name)}</strong><span>${units.length} unit${units.length===1?'':'s'}</span></div></div><div class="property-units">${units.map(u=>`<span class="unit-pill">${normalizeLabel(u.label)}${unitTenants[u.id]?` · <span class="mono" title="Tenant wallet, learned from a signed payment proof">${escapeHtml(shortAddress(unitTenants[u.id]))}</span> <button type="button" class="pill-x" data-forget-tenant="${escapeHtml(u.id)}" aria-label="Forget tenant wallet">×</button>`:''}</span>`).join('')||'<span class="hint">No units yet</span>'}</div></div>`;
  }).join('');
  return `<div class="page-title"><div><div class="eyebrow">PORTFOLIO</div><h1>Properties <em>& units.</em></h1><p>One building or an entire portfolio, the same rent ledger.</p></div></div>
  <div class="two-col"><div class="stack"><section class="panel"><h3>Add property</h3><form id="property-form" class="form-stack"><label>Property name<input name="name" maxlength="70" placeholder="e.g. Parkside building" required /></label><button class="primary" ${preview?'disabled':''} type="submit">${icon('plus')} Add property</button></form></section>
  <section class="panel"><h3>Add unit</h3><form id="unit-form" class="form-stack"><label>Property<select name="propertyId" required>${p.properties.map(b=>`<option value="${escapeHtml(b.id)}">${normalizeLabel(b.name)}</option>`).join('')}</select></label><label>Unit label<input name="label" maxlength="60" placeholder="e.g. A-102" required/></label><button class="primary" type="submit" ${preview||!p.properties.length?'disabled':''}>${icon('plus')} Add unit</button></form></section></div>
  <section class="stack"><div class="section-heading"><h2>Buildings</h2><span class="count">${p.properties.length}</span></div>${cards||emptyState('No properties yet','Add your first building using the form.', 'properties','Get started')}</section></div>
  <section class="panel backup-panel"><h3>Backup</h3><p class="form-hint">Your ledger is stored on this device only. Export a backup file to keep it safe or move it to another device.</p>
    <div class="backup-actions"><button id="export-backup" class="tertiary" type="button" ${preview||!p.properties.length?'disabled':''}>Export backup</button>
    <label class="tertiary file-label">Restore from file<input id="import-backup" type="file" accept="application/json,.json" ${preview?'disabled':''}/></label></div></section>`;
}
function collectionsView(p:Portfolio):string {
  const today=localDay();
  const filter=p.properties.some(x=>x.id===collectionsPropertyFilter)?collectionsPropertyFilter:'';
  const report=collectionQueue(p,today,dueDays,filter,proofEvidence(p));
  const units=p.units.filter(u=>!filter||u.propertyId===filter);
  const optionProperties=p.properties.map(x=>`<option value="${escapeHtml(x.id)}" ${x.id===filter?'selected':''}>${escapeHtml(x.name)}</option>`).join('');
  const proofRows=preview?[]:storedProofs.filter(x=>p.charges.some(c=>c.id===x.chargeId));
  const proofPanel=`<section class="panel" aria-label="Confirmed payments"><div class="section-heading"><h2>Confirmed payments</h2><span class="count">${proofRows.length}</span></div>
    <p class="form-hint">Each payment below was confirmed on Nimiq mainnet against its rent request. You can recheck them all at any time.</p>
    <div class="collection-list">${proofRows.map(x=>{const c=p.charges.find(y=>y.id===x.chargeId);const u=p.units.find(y=>y.id===c?.unitId);return `<div class="collection-row"><div><strong>${escapeHtml(u?.label||'Unit')} · ${escapeHtml(c?.period||'')}</strong><small>${formatNim(x.amountLuna)} NIM · tx ${escapeHtml(x.hash.slice(0,10))}… · ${escapeHtml(x.verifiedAt.slice(0,10))}</small></div><button type="button" class="tertiary" data-forget-proof="${escapeHtml(x.hash)}">Remove</button></div>`;}).join('')||'<p class="form-hint">No confirmed payments yet. They appear here automatically when a tenant pays, or when you check a transaction.</p>'}</div>
    <button id="recheck-proofs" type="button" class="tertiary" ${preview||!proofRows.length||recheckBusy?'disabled':''}>${recheckBusy?'Rechecking…':'Recheck all on mainnet'}</button>
    ${recheckMessage?`<p class="inline-alert" role="status">${escapeHtml(recheckMessage)}</p>`:''}
  </section>`;
  const rows=report.lines.map(x=>`<article class="collection-row">
    <div><strong>${escapeHtml(x.unitLabel)}</strong><small>${escapeHtml(x.propertyName)} · ${escapeHtml(x.period)} · due ${escapeHtml(x.dueDate)}</small></div>
    <div><strong>${formatNim(x.outstandingLuna)} NIM due</strong><small>${x.state==='NODE_MATCH_THIS_SESSION'?(x.outstandingLuna===0?'Paid ✓ on-chain':'Partly paid on-chain'):x.state==='NODE_REVIEW_REQUIRED'?'Needs review':x.state==='TX_NEEDS_VERIFICATION'?'Payment sent, confirming':x.daysLate>0?x.daysLate+' day'+(x.daysLate===1?'':'s')+' late':'Not paid yet'}</small></div>
    ${x.outstandingLuna>0?`<button class="tertiary" type="button" data-reminder="${escapeHtml(x.chargeId)}">Copy reminder</button>`:''}
  </article>`).join('');
  return `<div class="page-title"><div><div class="eyebrow">MONTHLY REVIEW</div><h1>What is <em>paid and due.</em></h1><p>Due dates, late requests and payments confirmed on-chain, unit by unit.</p></div></div>
  <section class="collection-summary panel" aria-label="Collections review">
    <div class="section-heading"><h2>Overview · ${escapeHtml(today)}</h2></div>
    <div class="period-filters"><label>Property<select id="collections-property"><option value="">All properties</option>${optionProperties}</select></label></div>
    <div class="period-metrics">
      <div><small>Still due</small><strong>${formatNim(report.outstandingLuna)} NIM</strong></div>
      <div><small>Past due date</small><strong>${formatNim(report.overdueLuna)} NIM</strong></div>
      <div><small>Late requests</small><strong>${report.overdueCount}</strong></div>
      <div><small>Paid on-chain</small><strong>${formatNim(report.observedNodeLuna)} NIM</strong></div>
    </div>
    ${syncBar()}
    <button id="download-collections" type="button" class="tertiary" ${!report.lines.length?'disabled':''}>Export CSV</button>
  </section>
  <section class="panel"><div class="section-heading"><h2>Requests</h2><span class="count">${report.lines.length}</span></div>
    <div class="collection-list">${rows||'<p class="form-hint">No rent requests yet.</p>'}</div>
  </section>
  ${proofPanel}
  <details class="panel details-panel"><summary>Due day per unit</summary><p class="form-hint">Day 1 to 28 of each month. Saved on this device.</p>
    <div class="collection-due-grid">${units.map(u=>`<label class="collection-due-row"><span>${escapeHtml(p.properties.find(q=>q.id===u.propertyId)?.name||'')} · ${escapeHtml(u.label)}</span><select data-due-unit="${escapeHtml(u.id)}" ${preview?'disabled':''}>${Array.from({length:28},(_,i)=>i+1).map(day=>`<option value="${day}" ${(dueDays[u.id]??1)===day?'selected':''}>${day}</option>`).join('')}</select></label>`).join('')||'<p>Add a unit to set its due day.</p>'}</div>
  </details>`;
}
function fiatContextPanel():string {
  return `<section class="panel" aria-label="Illustrative local currency rent estimate">
    <h3>Rent in local currency?</h3>
    <p class="form-hint">Convert a rent in CAD, USD, EUR or NGN to NIM with a price you enter.</p>
    <form id="fiat-context-form" class="form-stack">
      <label>Local currency<select name="currency"><option value="CAD">CAD</option><option value="USD">USD</option><option value="EUR">EUR</option><option value="NGN">NGN</option></select></label>
      <div class="form-duo"><label>Rent amount in that currency<input name="rentFiat" inputmode="decimal" maxlength="18" placeholder="1200.00" required/></label>
      <label>Price of 1 NIM in that currency<input name="fiatPerNim" inputmode="decimal" maxlength="24" placeholder="0.00123456" required/></label></div>
      <button class="tertiary" type="submit">Convert</button>
    </form>
    <p id="fiat-context-result" class="inline-alert" role="status">Enter the rent and the current NIM price.</p>
  </section>`;
}
function chargesView(p:Portfolio):string {
  const unsigned=preview?0:p.charges.filter(c=>!leaseOfCharge(c)&&!chargeSigned(c)).length;
  const recipientField=landlordWallet
    ?`<div class="locked-field"><small>Paid to your Nimiq Pay wallet</small><strong class="mono">${escapeHtml(landlordWallet)}</strong></div><details><summary class="form-hint">Use a different address</summary><textarea name="recipient" rows="2" placeholder="NQ.." spellcheck="false"></textarea><p class="form-hint">Requests to another address cannot be signed by your wallet; tenants will see them as unsigned.</p></details>`
    :`<label>Receiving address<textarea name="recipient" rows="2" placeholder="NQ.." spellcheck="false" required></textarea></label><p class="form-hint">Tip: connect Nimiq Pay on the Overview page so your wallet is used and every request is signed.</p>`;
  return `<div class="page-title"><div><div class="eyebrow">RENT REQUESTS</div><h1>Monthly <em>rent requests.</em></h1><p>One signed request per unit and month. Send the link, your tenant pays in Nimiq Pay.</p></div></div>
  <div class="two-col"><section class="panel"><h3>New rent request</h3><form id="charge-form" class="form-stack">
    <label>Unit<select name="unitId" required>${p.units.map(u=>`<option value="${escapeHtml(u.id)}">${normalizeLabel(p.properties.find(b=>b.id===u.propertyId)?.name||'')} / ${normalizeLabel(u.label)}</option>`).join('')}</select></label>
    <div class="form-duo"><label>Month<input name="period" type="month" value="${currentPeriod()}" required /></label><label>Amount (NIM)<input name="amount" inputmode="decimal" placeholder="1250.00" required /></label></div>
    ${recipientField}
    <p class="form-hint">Up to 2 decimals. The on-chain reference is a random RR1 code: no names go on-chain.</p>
    <button class="primary" type="submit" ${preview||!p.units.length?'disabled':''}>${icon('plus')} ${landlordWallet&&inNimiqPay?'Create and sign request':'Create request'}</button>
  </form></section><section class="stack"><div class="section-heading"><h2>Requests</h2>${unsigned&&landlordWallet?`<button id="sign-all" class="tertiary" type="button">${icon('shield')} Sign ${unsigned} unsigned</button>`:`<span class="count">${p.charges.length}</span>`}</div>${p.charges.length?p.charges.slice().reverse().map(c=>chargeRow(p,c)).join(''):emptyState('No rent requests yet','Add a property and a unit first.','properties','Add a property')}</section></div>
  ${renewalPlanner(p)}
  ${fiatContextPanel()}`;
}
function verifyResultCard(result:VerifyResult,requestedLuna:number):string{
  const proof=describeManualProof(requestedLuna,result.amountLuna,result.state);
  const ok=result.state==='FINAL_MATCHED';
  const pending=result.state==='INCLUDED_NOT_FINAL';
  const heading=ok?(proof.kind==='PARTIAL_NODE_MATCH'?'Partly paid ✓ confirmed on-chain':'Paid ✓ confirmed on-chain'):pending?'Included, finalizing…':result.state==='NOT_FOUND'?'Transaction not found yet':'Does not match this request';
  return `<div class="verify-result ${ok?'ok':pending?'pending':'bad'}" role="status">
    <strong>${escapeHtml(heading)}</strong>
    ${ok&&typeof result.amountLuna==='number'?`<p><b>${formatNim(result.amountLuna)} NIM</b> sent to the right address with the right reference${proof.kind==='PARTIAL_NODE_MATCH'&&proof.remainingLuna!==null?`. <b>${formatNim(proof.remainingLuna)} NIM</b> still due.`:'.'}</p>`:`<p>${escapeHtml(pending?'The transfer is in a block. Final confirmation usually takes about a minute.':result.message)}</p>`}
    <details><summary>Technical details</summary><small>Tx ${escapeHtml(result.hash)}${result.blockHeight?` · block ${result.blockHeight}`:''}${result.macroHeight?` · finalized by macro block ${result.macroHeight}`:''} · checked ${escapeHtml(result.observedAt)} via ${escapeHtml(result.rpcUrl)} (Nimiq mainnet history node).</small></details>
  </div>`;
}
function standaloneLookupPanel():string{
  let requested=0;try{requested=parseNim(manualReviewFields.amountNim);}catch{/* shown as invalid by the parser */}
  const status=manualReviewResult?verifyResultCard(manualReviewResult,requested):'';
  return `<form id="standalone-verify-form" class="form-stack" novalidate>
      <label>Transaction hash <input name="hash" type="text" maxlength="64" spellcheck="false" autocapitalize="off" autocomplete="off" placeholder="64-character transaction hash" required value="${escapeHtml(manualReviewFields.hash)}" /></label>
      <label>Receiving address <textarea name="recipient" rows="2" spellcheck="false" autocapitalize="off" placeholder="NQ.." required>${escapeHtml(manualReviewFields.recipient)}</textarea></label>
      <div class="form-duo">
        <label>Amount requested (NIM) <input name="amountNim" type="text" inputmode="decimal" placeholder="1250" required value="${escapeHtml(manualReviewFields.amountNim)}" /></label>
        <label>Rent reference <input name="memo" type="text" autocomplete="off" spellcheck="false" autocapitalize="off" placeholder="RR1:..." maxlength="36" required value="${escapeHtml(manualReviewFields.memo)}" /></label>
      </div>
      <button class="primary" type="submit" ${manualReviewBusy?'disabled':''}>${manualReviewBusy?'Checking Nimiq mainnet…':'Check payment'} ${icon('arrow')}</button>
    </form>
    ${manualReviewMessage?`<div class="inline-alert" role="alert">${escapeHtml(manualReviewMessage)}</div>`:''}
    ${status}`;
}
function checkPaymentView(p:Portfolio):string {
  const charges = preview ? [] : p.charges;
  const options = charges.map(c=>{const u=p.units.find(x=>x.id===c.unitId);return `<option value="${escapeHtml(c.id)}" ${txChargeId===c.id?'selected':''}>${escapeHtml(u?.label||'Unit')} · ${escapeHtml(c.period)} · ${formatNim(c.amountLuna)} NIM</option>`;}).join('');
  const charge=charges.find(c=>c.id===txChargeId);
  const result=txVerifyResult&&txVerifiedChargeId===txChargeId&&charge?verifyResultCard(txVerifyResult,charge.amountLuna):'';
  const own=`<section class="panel" aria-label="Check a payment for one of your requests"><h2>For one of your requests</h2>
    <p class="form-hint">Paste the transaction hash your tenant sent you. If it matches, the request is marked paid in your ledger.</p>
    <form id="g3-verify-form" class="form-stack">
      <label>Rent request<select name="chargeId" required ${!charges.length||txVerifyBusy?'disabled':''}><option value="" ${!txChargeId?'selected':''}>Choose a request…</option>${options}</select></label>
      <label>Transaction hash<input name="hash" type="text" maxlength="64" pattern="[a-fA-F0-9]{64}" spellcheck="false" autocomplete="off" placeholder="64-character transaction hash" value="${escapeHtml(txHashInput)}" required ${txVerifyBusy?'disabled':''}/></label>
      <button class="primary" type="submit" ${!charges.length||txVerifyBusy?'disabled':''}>${txVerifyBusy?'Checking Nimiq mainnet…':'Check and record'} ${icon('arrow')}</button>
    </form>
    ${!charges.length?`<p class="form-hint">${preview?'Leave the sample to check payments against your own requests.':'Create a rent request first, or use the form below.'}</p>`:''}
    ${result}
    ${txRecordMessage?`<p class="inline-alert ok-alert" role="status">${escapeHtml(txRecordMessage)}</p>`:''}
    ${txVerifyResult?.state==='FINAL_MATCHED' && txVerifiedChargeId===txChargeId?'<button id="g3-copy-audit" class="tertiary" type="button">Copy proof link</button>':''}
  </section>`;
  return `<div class="page-title"><div><div class="eyebrow">NIMIQ MAINNET</div><h1>Check a <em>payment.</em></h1><p>RentRail reads the transaction on Nimiq mainnet and checks the receiving address, the amount, the month's RR1 reference and finality.</p></div></div>
  ${own}
  <details class="panel details-panel" ${charges.length?'':'open'}><summary>Check any payment with its details</summary>
    <p class="form-hint">For a request that is not in this ledger: enter the details from the rent request.</p>
    ${standaloneLookupPanel()}
  </details>`;
}
function encodeRequest(r:SharedRequest):string {
  const text=asciiJson(r);
  return btoa(text).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'');
}
function decodeRequest(encoded:string):SharedRequest {
  if (!/^[a-z0-9_-]{1,3000}$/i.test(encoded)) throw new Error('This payment link is malformed.');
  const base64=encoded.replace(/-/g,'+').replace(/_/g,'/');
  const text=atob(base64);
  return validateSharedRequest(JSON.parse(text));
}
type LinkTrust={level:'signed'|'unsigned'|'tampered';text:string};
function linkTrust(request:SharedRequest):LinkTrust{
  if(request.lease){
    if(!requestMatchesLease(request))return {level:'tampered',text:'This month does not match its lease. Do not pay. Ask your landlord for a new link.'};
    if(!request.lease.sig)return {level:'unsigned',text:'This lease is not signed by a wallet. Confirm the receiving address with your landlord before paying.'};
    const check=verifySignedMessage(leaseMessage(request.lease),request.lease.sig);
    if(!check.valid||!sameAddress(check.signer,request.recipient))return {level:'tampered',text:'This lease was changed after the landlord signed it. Do not pay. Ask your landlord for a new link.'};
    return {level:'signed',text:`Monthly lease signed with Nimiq Pay by the owner of the receiving address: ${formatNim(request.lease.amountLuna)} NIM due on day ${request.lease.dueDay} of each month.`};
  }
  if(!request.sig)return {level:'unsigned',text:'This request is not signed by a wallet. Confirm the receiving address with your landlord before paying.'};
  const check=verifySignedMessage(rentRequestMessage(request),request.sig);
  if(!check.valid||!sameAddress(check.signer,request.recipient))return {level:'tampered',text:'This link was changed after the landlord signed it (address, amount, month or reference). Do not pay. Ask your landlord for a new link.'};
  return {level:'signed',text:'Signed with Nimiq Pay by the owner of the receiving address. Nothing in this link was changed.'};
}
function tenantPaySection(request:SharedRequest):string{
  const amountIssue=payableAmountIssue(request.amountLuna);
  const addressOk=isValidNimiqAddress(request.recipient);
  const trust=linkTrust(request);
  const history=recipientHistory(tenantMemory,request.recipient);
  if(payState==='confirmed'&&paidHash)return `<div class="pay-success" role="status"><div class="pay-success-icon">${icon('check')}</div><strong>Paid ✓ confirmed on-chain</strong><p>${formatNim(request.amountLuna)} NIM for ${escapeHtml(request.period)} reached the landlord's address with this month's reference, finalized on Nimiq mainnet.</p>
    <button id="tenant-share-proof" class="primary full" type="button" ${shareBusy?'disabled':''}>${icon('link')} ${shareBusy?'Signing…':'Send signed proof to my landlord'}</button>
    <button id="tenant-receipt" class="tertiary full" type="button">${icon('receipt')} Receipt (PDF)</button>
    <small>Your wallet signs the proof so your landlord knows the payment came from you.</small>
    <small class="mono">Tx ${escapeHtml(paidHash.slice(0,16))}…</small></div>`;
  if(payState==='sent'&&paidHash)return `<div class="pay-progress" role="status">
    <div class="pay-step done">${icon('check')}<span>Approved in Nimiq Pay</span></div>
    <div class="pay-step active"><span class="spinner" aria-hidden="true"></span><span>Confirming on Nimiq mainnet… usually about a minute</span></div>
    ${payMessage?`<p class="form-hint">${escapeHtml(payMessage)}</p>`:''}
    <button id="tenant-recheck" class="tertiary full" type="button">Check again now</button>
    <small class="mono">Tx ${escapeHtml(paidHash.slice(0,16))}…</small></div>`;
  if(payState==='unknown')return `<div class="inline-alert" role="alert">${icon('alert')}<div><strong>We couldn't confirm what happened.</strong> Open your Nimiq Pay history before paying again. ${escapeHtml(payMessage)}<br/><button id="tenant-reset-payment" class="tertiary" type="button">I checked: nothing was sent, try again</button></div></div>`;
  const blocked=trust.level==='tampered'?'This link was modified. Payment is blocked.':amountIssue||(!addressOk?'The receiving address is invalid. Ask your landlord for a new link.':null);
  const needsUnsignedAck=trust.level==='unsigned';
  const needsChangedAck=history==='CHANGED';
  const ackMissing=(needsUnsignedAck&&!unsignedAck)||(needsChangedAck&&!changedAddressAck);
  return `${blocked?`<div class="inline-alert danger" role="alert">${icon('alert')} ${escapeHtml(blocked)}</div>`:''}
    ${!blocked&&needsChangedAck?`<label class="consent"><input id="ack-changed" type="checkbox" ${changedAddressAck?'checked':''}/> My landlord confirmed this new receiving address to me.</label>`:''}
    ${!blocked&&needsUnsignedAck?`<label class="consent"><input id="ack-unsigned" type="checkbox" ${unsignedAck?'checked':''}/> I confirmed this receiving address with my landlord.</label>`:''}
    <button id="send-payment" class="primary full pay-button" type="button" ${blocked||ackMissing||payState==='paying'?'disabled':''}>${payState==='paying'?'Waiting for Nimiq Pay…':escapeHtml(payButtonLabel(request))}</button>
    ${payMessage?`<div class="inline-alert" role="status">${escapeHtml(payMessage)}</div>`:''}
    <p class="pay-note">You confirm the payment in Nimiq Pay. RentRail never holds your funds or keys.</p>`;
}
function otherOpenMonths(request:SharedRequest):string{
  if(!request.lease)return '';
  const open=tenantMemory.entries.filter(e=>e.request.lease?.id===request.lease!.id&&e.request.chargeId!==request.chargeId&&e.payment?.state!=='confirmed'&&e.payment?.state!=='sent');
  if(!open.length)return '';
  return `<div class="other-months"><strong>Also open on this lease</strong>${open.sort((a,b)=>a.request.period.localeCompare(b.request.period)).map(e=>{const u=new URL(window.location.pathname,window.location.origin);u.searchParams.set('pay',encodeRequest(e.request));return `<a href="${escapeHtml(u.toString())}">${escapeHtml(monthLabel(e.request.period))} · ${formatNim(e.request.amountLuna)} NIM →</a>`;}).join('')}</div>`;
}
function tenantView(request:SharedRequest):string {
  const addressOk=isValidNimiqAddress(request.recipient);
  const trust=linkTrust(request);
  const history=recipientHistory(tenantMemory,request.recipient);
  const historyNote=history==='KNOWN'?'<div class="trust-line ok">✓ Same landlord address as your previous rent.</div>':history==='CHANGED'?'<div class="trust-line bad">⚠ Different address than the landlord you paid before. Check with your landlord.</div>':'';
  const due=request.lease?`${request.period}-${String(request.lease.dueDay).padStart(2,'0')}`:null;
  const late=due&&localDay()>due&&payState!=='confirmed';
  const leaseEntries=request.lease?tenantMemory.entries.filter(e=>e.request.lease?.id===request.lease!.id).sort((a,b)=>a.request.period.localeCompare(b.request.period)).slice(-6):[];
  const rail=leaseEntries.length>1?rentRail(leaseEntries.map(e=>({period:e.request.period,state:(e.payment?.state==='confirmed'||(e.request.chargeId===request.chargeId&&payState==='confirmed')?'paid':e.request.period<currentPeriod()?'late':'due') as RailState}))):'';
  return `<div class="checkout pay-sheet">
  <div class="payee-card ${trust.level}">
    ${addressOk?identiconImg(request.recipient,64):''}
    <div class="payee-text"><small>Rent for ${escapeHtml(monthLabel(request.period))}</small><strong>${request.title?escapeHtml(request.title):'Your landlord'}</strong><span class="trust-chip ${trust.level}">${trust.level==='signed'?`${icon('shield')} Signed by landlord`:trust.level==='unsigned'?`${icon('alert')} Not signed`:`${icon('alert')} Link modified`}</span></div>
  </div>
  <div class="amount-block"><div class="checkout-value">${formatNim(request.amountLuna)} <span>NIM</span></div>${due?`<div class="due ${late?'late':''}">${late?'Late · was due':'Due'} ${escapeHtml(new Date(due+'T00:00:00Z').toLocaleDateString('en',{month:'long',day:'numeric',timeZone:'UTC'}))}</div>`:''}</div>
  ${rail?`<div class="sheet-rail">${rail}</div>`:''}
  <div class="checkout-card">
    <div class="trust-banner ${trust.level}" role="status">${icon(trust.level==='signed'?'shield':'alert')}<span>${escapeHtml(trust.text)}</span></div>
    <div class="detail"><span>Pay to</span><strong class="mono">${escapeHtml(addressOk?formatNimiqAddress(request.recipient):request.recipient)}</strong></div>
    ${addressOk?'<p class="identicon-hint">Nimiq Pay shows the same picture next to the recipient in its confirmation. Check that they match.</p>':''}
    <div class="detail"><span>Reference</span><strong class="mono">${escapeHtml(request.memo.slice(0,14))}…</strong></div>
    ${addressOk?historyNote:'<div class="trust-line bad">✗ Invalid address: do not pay.</div>'}
    <details class="crosscheck"><summary>Compare with the address your landlord gave you</summary>
      <form id="recipient-crosscheck-form" class="form-stack"><label>Address from your landlord<textarea name="confirmedRecipient" rows="2" maxlength="80" spellcheck="false" autocomplete="off" required placeholder="NQ.."></textarea></label><button class="tertiary" type="submit">Compare</button></form>
      ${tenantRecipientComparison?`<div role="status" class="inline-alert">${escapeHtml(tenantRecipientComparison)}</div>`:''}
    </details>
    <div class="pay-zone">${tenantPaySection(request)}</div>
    ${otherOpenMonths(request)}
  </div>${tenantEvidencePanel(request)}<p class="checkout-foot"><a href="/">My rent on RentRail</a></p>${payState==='confirmed'&&paidHash?receiptMarkup(tenantAudit(request,paidHash),receiptResult):''}</div>`;
}
function tenantAudit(request:SharedRequest,hash:string):PublicPaymentAudit{
  const claim=entryFor(tenantMemory,request.chargeId)?.payment?.claim;
  return createPaymentAudit(request,hash,claim);
}
function monthLabel(period:string):string{
  const [y,m]=period.split('-').map(Number);
  try{return new Date(Date.UTC(y,m-1,1)).toLocaleString('en',{month:'long',year:'numeric',timeZone:'UTC'});}catch{return period;}
}
function tenantEvidencePanel(request: SharedRequest): string {
  const result=tenantVerifyResult&&payState!=='confirmed'?verifyResultCard(tenantVerifyResult,request.amountLuna):'';
  return `<details class="checkout-card evidence-card details-panel" ${tenantVerifyResult&&payState!=='confirmed'?'open':''}>
    <summary>Already paid from another wallet? Check it</summary>
    <form id="tenant-proof-form" class="form-stack">
      <label>Transaction hash<input name="hash" value="${escapeHtml(payState==='confirmed'?'':tenantHash)}" maxlength="64" pattern="[a-fA-F0-9]{64}" type="text" spellcheck="false" autocomplete="off" placeholder="64-character transaction hash" required/></label>
      <button class="tertiary" ${tenantVerifyBusy?'disabled':''} type="submit">${tenantVerifyBusy?'Checking…':'Check this transaction'} ${icon('arrow')}</button>
    </form>
    ${result}
    ${tenantVerifyResult?.state==='FINAL_MATCHED'&&payState!=='confirmed'?'<button id="tenant-copy-audit" class="tertiary full" type="button">Copy proof link for my landlord</button>':''}
  </details>`;
}
function payerInfo(audit:PublicPaymentAudit):{address:string|null;note:string;level:'ok'|'warn'|'none'}{
  if(!audit.payer)return {address:null,note:'Payer not identified: this proof was not signed by the tenant\'s wallet.',level:'none'};
  const check=verifySignedMessage(paymentClaimMessage(audit.request.memo,audit.txHash),audit.payer);
  if(!check.valid)return {address:null,note:'The payer signature is invalid and was ignored.',level:'warn'};
  const charge=portfolio.charges.find(c=>c.id===audit.request.chargeId);
  const bound=charge?unitTenants[charge.unitId]:undefined;
  if(bound&&!sameAddress(bound,check.signer))return {address:check.signer,note:'Paid and signed by a different wallet than this unit\'s usual tenant.',level:'warn'};
  return {address:check.signer,note:bound?'Paid by your tenant\'s wallet ✓':'Signed by the payer\'s Nimiq Pay wallet.',level:'ok'};
}
function independentAuditView(audit:PublicPaymentAudit):string {
  const r=audit.request;
  const status=publicAuditResult?verifyResultCard(publicAuditResult,r.amountLuna):`<div class="verify-result pending" role="status"><strong>${publicAuditBusy?'Checking Nimiq mainnet…':'Not checked yet'}</strong></div>`;
  const known=portfolio.charges.some(c=>c.id===r.chargeId);
  const payer=payerInfo(audit);
  return `<div class="checkout evidence-checkout"><div class="checkout-head"><div class="eyebrow">RENT PAYMENT PROOF</div><h1>${escapeHtml(monthLabel(r.period))} <em>rent proof.</em></h1><p>${r.title?escapeHtml(r.title)+' · ':''}checked live against Nimiq mainnet on this device.</p></div>
  <section class="checkout-card">
    <span class="checkout-label">Requested</span>
    <div class="checkout-value">${formatNim(r.amountLuna)} <span>NIM</span></div>
    <div class="hr"></div>
    <div class="detail"><span>Paid to</span><strong class="mono">${escapeHtml(isValidNimiqAddress(r.recipient)?formatNimiqAddress(r.recipient):r.recipient)}</strong></div>
    <div class="detail"><span>Paid by</span><strong class="mono">${payer.address?escapeHtml(formatNimiqAddress(payer.address)):'Unknown'}</strong></div>
    <div class="trust-line ${payer.level==='ok'?'ok':payer.level==='warn'?'bad':''}">${escapeHtml(payer.note)}</div>
    <div class="detail"><span>Reference</span><strong class="mono">${escapeHtml(r.memo.slice(0,14))}…</strong></div>
    <div class="detail"><span>Transaction</span><strong class="mono">${escapeHtml(audit.txHash.slice(0,16))}…</strong></div>
    ${status}
    ${publicAuditRecorded?`<p class="inline-alert ok-alert" role="status">${escapeHtml(publicAuditRecorded)}</p>`:known?'':'<p class="form-hint">Landlord: open this link on the device that holds your RentRail ledger and the request is marked paid automatically.</p>'}
    ${publicAuditResult?.state==='FINAL_MATCHED'?`<button id="audit-receipt" class="primary full" type="button">${icon('receipt')} Receipt (PDF)</button>`:''}
    <button id="audit-recheck" class="tertiary full" ${publicAuditBusy?'disabled':''} type="button">${publicAuditBusy?'Checking…':'Check again'} ${icon('arrow')}</button>
    <a class="tertiary" href="/">Open RentRail</a>
  </section>${receiptMarkup(audit,publicAuditResult)}</div>`;
}
function receiptMarkup(audit:PublicPaymentAudit,result:VerifyResult|null):string{
  if(!result||result.state!=='FINAL_MATCHED'||result.hash!==audit.txHash)return '';
  const r=audit.request;
  const payer=payerInfo(audit);
  const link=auditUrl(window.location.origin,window.location.pathname,audit);
  let qrSvg='';
  try{const q=qrcode(0,'L');q.addData(link);q.make();qrSvg=q.createSvgTag({cellSize:2,margin:0,scalable:true});}catch{qrSvg='';}
  return `<article class="receipt" aria-label="Rent payment receipt">
    <header><div><strong>RentRail</strong><span>Rent payment receipt · on-chain proof</span></div><span class="receipt-badge">PAID ✓</span></header>
    <h2>${escapeHtml(monthLabel(r.period))} rent${r.title?` · ${escapeHtml(r.title)}`:''}</h2>
    <dl>
      <div><dt>Amount</dt><dd>${typeof result.amountLuna==='number'?formatNim(result.amountLuna):formatNim(r.amountLuna)} NIM</dd></div>
      <div><dt>Month</dt><dd>${escapeHtml(r.period)}</dd></div>
      <div><dt>Paid to</dt><dd class="mono">${escapeHtml(isValidNimiqAddress(r.recipient)?formatNimiqAddress(r.recipient):r.recipient)}</dd></div>
      <div><dt>Paid by</dt><dd class="mono">${payer.address?escapeHtml(formatNimiqAddress(payer.address)):'Not identified'}</dd></div>
      <div><dt>Reference</dt><dd class="mono">${escapeHtml(r.memo)}</dd></div>
      <div><dt>Transaction</dt><dd class="mono">${escapeHtml(audit.txHash)}</dd></div>
      <div><dt>Block</dt><dd>${result.blockHeight??'-'} (final at macro block ${result.macroHeight??'-'})</dd></div>
      <div><dt>Verified</dt><dd>${escapeHtml(result.observedAt.slice(0,19).replace('T',' '))} UTC, Nimiq mainnet</dd></div>
    </dl>
    <footer>${qrSvg?`<div class="receipt-qr">${qrSvg}</div>`:''}<p>Scan or open the proof link to re-check this payment on Nimiq mainnet at any time. This receipt records a blockchain payment; it is not a lease or tax document.</p></footer>
  </article>`;
}
function render():void {
  const p=activePortfolio();
  const content=publicAudit?independentAuditView(publicAudit):publicAuditError?`<div class="error-page"><h1>Invalid proof link</h1><p>${escapeHtml(publicAuditError)}</p><a href="/">Open RentRail</a></div>`:tenantRequest?tenantView(tenantRequest):tenantError?`<div class="error-page"><h1>Invalid rent request link</h1><p>${escapeHtml(tenantError)}</p><a href="/">Open RentRail</a></div>`:({overview:()=>overview(p),properties:()=>propertiesView(p),charges:()=>chargesView(p),collections:()=>collectionsView(p),wallet:()=>checkPaymentView(p)})[selectedView]();
  root!.innerHTML=`<div class="app-shell ${tenantRequest||publicAudit||publicAuditError?'tenant-shell':''}">
    <aside class="sidebar"><a class="brand" href="/"><span class="brand-symbol">R<span>·</span></span><span>rentrail<small>RENT ON NIMIQ PAY</small></span></a>
      <span class="nav-label">WORKSPACE</span><nav aria-label="Main navigation">${navButton('overview','Overview','home')}${navButton('properties','Properties','building')}${navButton('charges','Rent requests','receipt')}${navButton('collections','Monthly review','calendar-clock')}${navButton('wallet','Check payment','wallet')}</nav>
      <div class="sidebar-bottom"><div class="side-note">${icon('shield')}<span>Non-custodial<br/><small>Tenant pays landlord directly</small></span></div></div>
    </aside><div class="main-wrap"><header class="topbar"><a class="mobile-brand" href="/"><span class="brand-symbol">R<span>·</span></span><small>rentrail</small></a><span class="topbar-caption">${publicAudit?'PAYMENT PROOF':tenantRequest?'RENT REQUEST':({overview:'OVERVIEW',properties:'PROPERTIES',charges:'RENT REQUESTS',collections:'MONTHLY REVIEW',wallet:'CHECK PAYMENT'})[selectedView]}</span><div class="topbar-right">${preview?'<span class="label-chip">SAMPLE</span>':''}${walletIndicator()}</div></header>
      <main class="main-content">${preview?`<div class="demo-banner">${icon('alert')} Sample portfolio: fictional units, nothing is sent. <button id="exit-preview">Exit sample</button></div>`:''}${content}${toast?`<div class="toast" role="status">${escapeHtml(toast)}</div>`:''}</main>
      ${!tenantRequest&&!publicAudit&&!publicAuditError?`<nav class="mobile-nav" aria-label="Mobile navigation">${navButton('overview','Home','home')}${navButton('properties','Units','building')}${navButton('charges','Rent','receipt')}${navButton('collections','Review','calendar-clock')}${navButton('wallet','Check','wallet')}</nav>`:''}
    </div></div>`;
  bindEvents();
  hydrateIdenticons();
}
function success(message:string):void { toast=message; render(); setTimeout(()=>{ toast='';render(); },4600); }
// Errors must not re-render: the user's form input stays in place so they can fix it.
function error(message:string):void {
  toast=message;
  const main=root!.querySelector('.main-content');
  let el=root!.querySelector<HTMLElement>('.toast');
  if(!el&&main){el=document.createElement('div');el.className='toast';el.setAttribute('role','status');main.appendChild(el);}
  if(el){el.textContent=message;el.classList.add('toast-error');}
  setTimeout(()=>{if(toast===message){toast='';root!.querySelector('.toast')?.remove();}},6000);
}
function formValue(form:HTMLFormElement,key:string):string { return String(new FormData(form).get(key)||'').trim(); }
function bindEvents():void {
  root!.querySelectorAll<HTMLButtonElement>('[data-audience]').forEach(button=>button.addEventListener('click',()=>{
    const value=button.dataset.audience;
    if(!validAudience(value))return;
    audience=value;
    if(audience!=='explorer')preview=false;
    try{localStorage.setItem(AUDIENCE_KEY,value);}catch{/* Local preference only. */}
    selectedView='overview';toast='';render();window.scrollTo(0,0);
  }));
  root!.querySelectorAll<HTMLButtonElement>('[data-journey]').forEach(button=>button.addEventListener('click',()=>{
    const step=journeySteps(audience,preview?emptyPortfolio():activePortfolio(),storedProofs.length>0)[Number(button.dataset.journey)];
    if(!step)return;
    if(step.action==='preview'){audience='explorer';preview=true;selectedView='overview';render();window.scrollTo(0,0);return;}
    if(step.action==='instructions'){selectedView='overview';render();document.querySelector('#tenant-help')?.scrollIntoView({behavior:'smooth',block:'center'});return;}
    if(step.action==='view'&&step.view){selectedView=step.view;render();window.scrollTo(0,0);}
  }));
  const standaloneForm=root!.querySelector<HTMLFormElement>('#standalone-verify-form');
  standaloneForm?.addEventListener('submit',e=>{e.preventDefault();void onStandaloneVerify(standaloneForm);});
  root!.querySelectorAll<HTMLButtonElement>('[data-nav]').forEach(button=>button.addEventListener('click',()=>{
    selectedView=button.dataset.nav as View; toast=''; render(); window.scrollTo(0,0);
  }));
  root!.querySelector('#preview-demo')?.addEventListener('click',()=>{preview=true; render();});
  root!.querySelector('#exit-preview')?.addEventListener('click',()=>{preview=false; render();});
  const propertyForm=root!.querySelector<HTMLFormElement>('#property-form');
  propertyForm?.addEventListener('submit',e=>{e.preventDefault();try{safePersist(addProperty(portfolio,{id:randomId(),name:formValue(propertyForm,'name'),createdAt:new Date().toISOString()}));success('Property added.');}catch(err){error(explainHostError(err));}});
  const unitForm=root!.querySelector<HTMLFormElement>('#unit-form');
  unitForm?.addEventListener('submit',e=>{e.preventDefault();try{safePersist(addUnit(portfolio,{id:randomId(),propertyId:formValue(unitForm,'propertyId'),label:formValue(unitForm,'label')}));success('Unit added.');}catch(err){error(explainHostError(err));}});
  const fiatContextForm=root!.querySelector<HTMLFormElement>('#fiat-context-form');
  fiatContextForm?.addEventListener('submit',e=>{
    e.preventDefault();
    const target=root!.querySelector<HTMLElement>('#fiat-context-result');
    if(!target)return;
    try{
      const amount=illustrateRentNim(formValue(fiatContextForm,'currency'),formValue(fiatContextForm,'rentFiat'),formValue(fiatContextForm,'fiatPerNim'));
      target.textContent=`≈ ${amount.estimatedNim} NIM for ${amount.rentFiat} ${amount.currency} at ${amount.fiatPerNim} ${amount.currency} per NIM. Round to 2 decimals when you create the request.`;
    }catch(err){target.textContent=err instanceof Error?err.message:'Invalid price or rent amount.';}
  });
  const chargeForm=root!.querySelector<HTMLFormElement>('#charge-form');
  chargeForm?.addEventListener('submit',e=>{e.preventDefault();void onCreateCharge(chargeForm);});
  root!.querySelectorAll<HTMLButtonElement>('[data-sign]').forEach(b=>b.addEventListener('click',()=>void onSignCharges([b.dataset.sign||''])));
  root!.querySelector('#sign-all')?.addEventListener('click',()=>void onSignCharges(portfolio.charges.filter(c=>!leaseOfCharge(c)&&!chargeSigned(c)).map(c=>c.id)));
  root!.querySelector('#connect-wallet')?.addEventListener('click',()=>void onConnectWallet());
  root!.querySelector('#sync-payments')?.addEventListener('click',()=>void onSyncPayments());
  const leaseForm=root!.querySelector<HTMLFormElement>('#lease-form');
  leaseForm?.addEventListener('submit',e=>{e.preventDefault();void onCreateLease(leaseForm);});
  root!.querySelectorAll<HTMLButtonElement>('[data-sign-lease]').forEach(b=>b.addEventListener('click',()=>void onSignLease(b.dataset.signLease||'')));
  root!.querySelectorAll<HTMLButtonElement>('[data-share-lease]').forEach(b=>b.addEventListener('click',()=>void onShareLease(b.dataset.shareLease||'')));
  root!.querySelectorAll<HTMLButtonElement>('[data-end-lease]').forEach(b=>b.addEventListener('click',()=>{
    const l=leases.find(x=>x.id===b.dataset.endLease);if(!l)return;
    if(!window.confirm('End this lease? No new monthly requests will be created. Past requests and payments stay in your ledger.'))return;
    try{saveLeases(leases.filter(x=>x.id!==l.id));success('Lease ended.');}catch{error('Browser storage did not accept this change.');}
  }));
  root!.querySelector('#disconnect-wallet')?.addEventListener('click',()=>{if(window.confirm('Use a different Nimiq Pay wallet? Existing requests keep their signatures.')){saveLandlordWallet(null);render();}});
  root!.querySelector<HTMLInputElement>('#ack-unsigned')?.addEventListener('change',e=>{unsignedAck=(e.target as HTMLInputElement).checked;render();});
  root!.querySelector<HTMLInputElement>('#ack-changed')?.addEventListener('change',e=>{changedAddressAck=(e.target as HTMLInputElement).checked;render();});
  root!.querySelector('#tenant-receipt')?.addEventListener('click',()=>void onPrintTenantReceipt());
  root!.querySelector('#audit-receipt')?.addEventListener('click',()=>window.print());
  root!.querySelectorAll<HTMLButtonElement>('[data-forget-tenant]').forEach(b=>b.addEventListener('click',()=>{
    const id=b.dataset.forgetTenant||'';if(!unitTenants[id])return;
    if(!window.confirm('Forget the tenant wallet for this unit? The next signed payment proof will set it again.'))return;
    const next={...unitTenants};delete next[id];try{saveUnitTenants(next);render();}catch{error('Browser storage did not accept this change.');}
  }));
  root!.querySelectorAll<HTMLButtonElement>('[data-share]').forEach(button=>button.addEventListener('click',async()=>{
    const charge=portfolio.charges.find(c=>c.id===button.dataset.share);
    if(!charge||preview)return;
    const url=new URL(window.location.pathname,window.location.origin);
    url.searchParams.set('pay',encodeRequest(requestForCharge(charge)));
    const unit=portfolio.units.find(u=>u.id===charge.unitId);
    await shareOrCopy(url.toString(),`Rent ${monthLabel(charge.period)}${unit?` · ${unit.label}`:''}: ${formatNim(charge.amountLuna)} NIM. Open in Nimiq Pay to pay:`,'Rent request link copied. Send it to your tenant.');
  }));
  root!.querySelectorAll<HTMLInputElement>('#month-filter, #renewal-month').forEach(input=>input.addEventListener('change',e=>{
    const month=(e.target as HTMLInputElement).value;
    if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))return;
    workspaceMonth=month;nextPeriodPreview=null;render();
  }));
  root!.querySelector<HTMLSelectElement>('#property-filter')?.addEventListener('change',e=>{
    filterProperty=(e.target as HTMLSelectElement).value;render();
  });
  root!.querySelector('#preview-renewal')?.addEventListener('click',()=>{
    if(preview)return;
    try {
      const next=nextMonth(workspaceMonth);
      const source=portfolio.charges.filter(c=>c.period===workspaceMonth);
      const eligible=source.filter(c=>!portfolio.charges.some(x=>x.unitId===c.unitId&&x.period===next));
      nextPeriodPreview={period:workspaceMonth,next,count:eligible.length,skipped:source.length-eligible.length};
      render();
    }catch(err){error(explainHostError(err));}
  });
  root!.querySelector('#confirm-renewal')?.addEventListener('click',()=>{
    if(preview||!nextPeriodPreview||nextPeriodPreview.period!==workspaceMonth)return;
    try{
      const next=nextMonth(workspaceMonth);
      const source=portfolio.charges.filter(c=>c.period===workspaceMonth);
      const eligible=source.filter(c=>!portfolio.charges.some(x=>x.unitId===c.unitId&&x.period===next));
      if(eligible.length!==nextPeriodPreview.count)throw Error('Monthly plan changed: review again.');
      const result=planNextPeriod(portfolio,workspaceMonth,eligible.map(()=>randomId()),new Date().toISOString());
      nextPeriodPreview=null;
      safePersist(result.portfolio);
      success(`${result.generated} rent request(s) created for ${result.newPeriod}.`);
    }catch(err){nextPeriodPreview=null;error(explainHostError(err));}
  });
  root!.querySelector('#collections-property')?.addEventListener('change',e=>{
    collectionsPropertyFilter=(e.target as HTMLSelectElement).value;render();
  });
  root!.querySelectorAll<HTMLSelectElement>('[data-due-unit]').forEach(input=>input.addEventListener('change',()=>{
    if(preview)return;
    const unit=input.dataset.dueUnit||'',day=Number(input.value);
    if(!portfolio.units.some(u=>u.id===unit)||!validDueDay(day)){error('Invalid due day.');return;}
    try{
      const next={...dueDays,[unit]:day};
      localStorage.setItem(DUE_STORAGE_KEY,JSON.stringify(next));dueDays=next;render();
    }catch{error('Could not save due-day settings in this browser.');}
  }));
  root!.querySelector('#download-collections')?.addEventListener('click',()=>{
    const report=collectionQueue(activePortfolio(),localDay(),dueDays,collectionsPropertyFilter,proofEvidence(activePortfolio()));
    if(!report.lines.length)return;
    downloadFile('rentrail-review-'+localDay()+'.csv','﻿'+collectionCsv(report),'text/csv;charset=utf-8');
    success('CSV exported.');
  });
  root!.querySelector('#export-backup')?.addEventListener('click',()=>{
    if(preview)return;
    downloadFile('rentrail-backup-'+localDay()+'.json',createBackup(portfolio,storedProofs,dueDays,new Date(),leases,unitTenants),'application/json');
    success('Backup exported. Keep the file somewhere safe.');
  });
  root!.querySelector<HTMLInputElement>('#import-backup')?.addEventListener('change',async e=>{
    const file=(e.target as HTMLInputElement).files?.[0];
    if(!file||preview)return;
    try{
      const restored=restoreBackup(await file.text());
      if((portfolio.charges.length||portfolio.properties.length)&&!window.confirm(`Replace this device's ledger with the backup (${restored.portfolio.properties.length} properties, ${restored.portfolio.charges.length} rent requests)?`))return;
      savePortfolio(restored.portfolio);portfolio=restored.portfolio;
      persistProofs(restored.proofs);
      localStorage.setItem(DUE_STORAGE_KEY,JSON.stringify(restored.dueDays));dueDays=restored.dueDays;
      saveLeases(restored.leases);saveUnitTenants(restored.unitTenants);
      success('Backup restored.');
    }catch(err){error(err instanceof Error?err.message:'Could not restore this file.');}
  });
  root!.querySelectorAll<HTMLButtonElement>('[data-reminder]').forEach(btn=>btn.addEventListener('click',async()=>{
    const q=collectionQueue(activePortfolio(),localDay(),dueDays,collectionsPropertyFilter,proofEvidence(activePortfolio()));
    const line=q.lines.find(x=>x.chargeId===btn.dataset.reminder);
    if(!line||preview)return;
    const charge=portfolio.charges.find(c=>c.id===line.chargeId);
    let draft=reminderDraft(line);
    if(charge){const url=new URL(window.location.pathname,window.location.origin);url.searchParams.set('pay',encodeRequest(requestForCharge(charge)));draft+=`\nPay in Nimiq Pay: ${url.toString()}`;}
    try{
      if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(draft);success('Reminder copied with the payment link. Nothing was sent.');}
      else window.prompt('Copy this reminder',draft);
    }catch{window.prompt('Copy this reminder',draft);}
  }));
  root!.querySelector('#recipient-crosscheck-form')?.addEventListener('submit',e=>{
    e.preventDefault();
    if(!tenantRequest)return;
    const form=e.target as HTMLFormElement;
    tenantRecipientComparison=compareIndependentRecipient(tenantRequest.recipient,formValue(form,'confirmedRecipient')).message;
    render();
    const details=root!.querySelector<HTMLDetailsElement>('details.crosscheck');if(details)details.open=true;
  });
  root!.querySelector('#tenant-proof-form')?.addEventListener('submit',e=>{
    e.preventDefault();
    void onTenantEvidence(e.target as HTMLFormElement);
  });
  root!.querySelector('#audit-recheck')?.addEventListener('click',()=>void onAuditRecheck());
  root!.querySelector('#tenant-copy-audit')?.addEventListener('click',()=>void onCopyAudit('tenant'));
  root!.querySelector('#tenant-share-proof')?.addEventListener('click',()=>void onSharePaidProof());
  root!.querySelector('#g3-copy-audit')?.addEventListener('click',()=>void onCopyAudit('owner'));
  root!.querySelector('#recheck-proofs')?.addEventListener('click',()=>void onRecheckProofs());
  root!.querySelectorAll<HTMLButtonElement>('[data-forget-proof]').forEach(b=>b.addEventListener('click',()=>{
    if(preview||recheckBusy)return;
    if(!window.confirm('Remove this confirmed payment from your ledger? The request will show as unpaid until you check it again.'))return;
    try{persistProofs(removeProof(storedProofs,b.dataset.forgetProof||''));recheckMessage='';render();}
    catch{error('Browser storage did not accept this change.');}
  }));
  const g3Form=root!.querySelector<HTMLFormElement>('#g3-verify-form');
  g3Form?.addEventListener('submit',e=>{e.preventDefault();void onVerifyG3(g3Form);});
  root!.querySelector('#send-payment')?.addEventListener('click',()=>void onTenantPay());
  root!.querySelector('#tenant-recheck')?.addEventListener('click',()=>{confirmPolls=0;void pollConfirmation();});
  root!.querySelector('#tenant-reset-payment')?.addEventListener('click',()=>{
    if(!tenantRequest)return;
    persistTenant(setPayment(tenantMemory,tenantRequest.chargeId,undefined));
    payState='idle';payMessage='';paidHash=null;render();
  });
}
function downloadFile(name:string,content:string,type:string):void{
  const url=URL.createObjectURL(new Blob([content],{type}));
  const link=document.createElement('a');link.href=url;link.download=name;document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function shareOrCopy(url:string,text:string,copiedMessage:string):Promise<void>{
  if(typeof navigator.share==='function'){
    try{await navigator.share({text,url});return;}catch(e){if(e instanceof DOMException&&e.name==='AbortError')return;}
  }
  try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(`${text} ${url}`);success(copiedMessage);return;}}catch{/* fall back */}
  window.prompt('Copy this link',url);
}
async function onCopyAudit(where:'tenant'|'owner'|'paid'):Promise<void>{
  try{
    let request:SharedRequest;
    let hash:string;
    if(where==='paid'){
      if(!tenantRequest||!paidHash||payState!=='confirmed')return;
      request=tenantRequest;hash=paidHash;
    }else if(where==='tenant'){
      if(!tenantRequest||tenantVerifyResult?.state!=='FINAL_MATCHED')return;
      request=tenantRequest;hash=tenantVerifyResult.hash;
    }else{
      if(txVerifyResult?.state!=='FINAL_MATCHED')return;
      const charge=portfolio.charges.find(c=>c.id===txChargeId);
      if(!charge||txVerifiedChargeId!==charge.id)return;
      request=shareableRequest(charge);hash=txVerifyResult.hash;
    }
    const url=auditUrl(window.location.origin,window.location.pathname,createPaymentAudit(request,hash));
    await shareOrCopy(url,`Rent ${monthLabel(request.period)} paid: ${formatNim(request.amountLuna)} NIM. Proof on Nimiq mainnet:`,'Proof link copied. Send it to your landlord.');
  }catch(err){error(explainHostError(err));}
}
async function onTenantEvidence(form:HTMLFormElement):Promise<void>{
  if(tenantVerifyBusy||!tenantRequest)return;
  tenantHash=formValue(form,'hash');
  tenantVerifyResult=null;
  tenantVerifyBusy=true;render();
  try{
    tenantVerifyResult=await verifyNimTransaction({hash:tenantHash,
      recipient:tenantRequest.recipient,memo:tenantRequest.memo,
      amountLuna:tenantRequest.amountLuna,allowPartial:true});
    recordProof(tenantRequest.chargeId,tenantVerifyResult);
  }catch{tenantVerifyResult=null;error('Could not reach Nimiq mainnet. Try again.');}
  finally{tenantVerifyBusy=false;render();}
}
async function onAuditRecheck():Promise<void>{
  if(!publicAudit||publicAuditBusy)return;
  publicAuditBusy=true;publicAuditResult=null;publicAuditRecorded='';render();
  try{
    publicAuditResult=await verifyNimTransaction({hash:publicAudit.txHash,
      recipient:publicAudit.request.recipient,memo:publicAudit.request.memo,
      amountLuna:publicAudit.request.amountLuna,allowPartial:true});
    const charge=portfolio.charges.find(c=>c.id===publicAudit!.request.chargeId&&c.memo===publicAudit!.request.memo&&c.recipient===publicAudit!.request.recipient&&c.amountLuna===publicAudit!.request.amountLuna);
    if(charge){
      const payer=payerInfo(publicAudit);
      const outcome=recordProof(charge.id,publicAuditResult,payer.address??undefined);
      if(payer.address&&!unitTenants[charge.unitId]&&(outcome==='ADDED'||outcome==='ALREADY_RECORDED')){
        try{saveUnitTenants({...unitTenants,[charge.unitId]:formatNimiqAddress(payer.address)});}catch{/* binding is optional */}
      }
      if(outcome==='ADDED')publicAuditRecorded='Recorded in your ledger: this rent request is now marked paid.';
      else if(outcome==='ALREADY_RECORDED')publicAuditRecorded='Already recorded in your ledger.';
      else if(outcome==='USED_BY_OTHER_CHARGE')publicAuditRecorded='This transaction is already credited to another rent request in your ledger. Not counted twice.';
    }
  }catch{publicAuditResult=null;error('Could not reach Nimiq mainnet. Try again.');}
  finally{publicAuditBusy=false;render();}
}
async function onStandaloneVerify(form:HTMLFormElement):Promise<void>{
  if(manualReviewBusy)return;
  manualReviewFields={
    hash:formValue(form,'hash'),
    recipient:formValue(form,'recipient'),
    memo:formValue(form,'memo'),
    amountNim:formValue(form,'amountNim'),
  };
  manualReviewResult=null;manualReviewMessage='';
  let input;
  try{input=parseManualPaymentReview(manualReviewFields);}
  catch(err){manualReviewMessage=err instanceof Error?err.message:'Invalid payment details.';render();return;}
  manualReviewBusy=true;render();
  try{manualReviewResult=await verifyNimTransaction(input);}
  catch{manualReviewMessage='The read-only node could not complete the check. No amount is credited.';}
  finally{manualReviewBusy=false;render();}
}
async function onRecheckProofs():Promise<void>{
  if(preview||recheckBusy||!storedProofs.length)return;
  recheckBusy=true;recheckMessage='';render();
  let confirmed=0,failed=0,unreachable=0;
  let kept=storedProofs.slice();
  try{
    for(const proof of storedProofs){
      const charge=portfolio.charges.find(c=>c.id===proof.chargeId);
      if(!charge){continue;}
      const result=await verifyNimTransaction({hash:proof.hash,recipient:charge.recipient,memo:charge.memo,amountLuna:charge.amountLuna,allowPartial:true});
      if(result.state==='FINAL_MATCHED'&&result.amountLuna===proof.amountLuna)confirmed++;
      else if(result.state==='REVIEW_REQUIRED'||result.state==='NOT_FOUND'){failed++;kept=removeProof(kept,proof.hash);}
      else unreachable++;
    }
    if(failed)persistProofs(kept);
    recheckMessage=`${confirmed} confirmed again on mainnet${failed?`, ${failed} no longer matched and ${failed===1?'was':'were'} removed`:''}${unreachable?`, ${unreachable} could not be checked right now`:''}.`;
  }catch{recheckMessage='Could not finish the recheck. Try again.';}
  finally{recheckBusy=false;render();}
}
async function onVerifyG3(form:HTMLFormElement):Promise<void>{
  if(txVerifyBusy||preview)return;
  txChargeId=formValue(form,'chargeId');
  txHashInput=formValue(form,'hash');
  txVerifyResult=null;txRecordMessage='';
  const charge=portfolio.charges.find(c=>c.id===txChargeId);
  if(!charge){error('Choose a rent request.');return;}
  txVerifyBusy=true;render();
  try{
    const result=await verifyNimTransaction({hash:txHashInput,recipient:charge.recipient,memo:charge.memo,amountLuna:charge.amountLuna,allowPartial:true});
    txVerifyResult=result;
    txVerifiedChargeId=charge.id;
    const outcome=recordProof(charge.id,result);
    txRecordMessage=outcome==='ADDED'?'Recorded: the request is updated in your ledger.':outcome==='ALREADY_RECORDED'?'This payment was already recorded.':outcome==='USED_BY_OTHER_CHARGE'?'This transaction is already credited to another request. Not counted twice.':'';
  }catch{
    txVerifyResult=null;
    error('Could not reach Nimiq mainnet. Nothing was recorded.');
  }finally{txVerifyBusy=false;render();}
}
async function onTenantPay():Promise<void>{
  if(!tenantRequest||payState!=='idle')return;
  const request=tenantRequest;
  payState='paying';payMessage='';render();
  try{
    const hash=await payRentRequest(request);
    paidHash=hash;tenantHash=hash;payState='sent';
    rememberPayment(request.chargeId,'sent',hash);
    if(portfolio.charges.some(c=>c.id===request.chargeId)){
      try{const next=recordSubmission(portfolio,{chargeId:request.chargeId,hash,state:'SUBMITTED_UNVERIFIED',createdAt:new Date().toISOString()});savePortfolio(next);portfolio=next;}
      catch{/* already recorded on this device */}
    }
    render();
    confirmPolls=0;
    void pollConfirmation();
  }catch(err){
    const kind=err instanceof PayError?err.kind:'UNKNOWN_OUTCOME';
    payMessage=err instanceof Error?err.message:'Payment could not be started.';
    if(kind==='UNKNOWN_OUTCOME'){payState='unknown';rememberPayment(request.chargeId,'unknown',null);}
    else payState='idle';
    render();
  }
}
async function pollConfirmation():Promise<void>{
  if(!tenantRequest||!paidHash||payState!=='sent')return;
  if(confirmTimer){clearTimeout(confirmTimer);confirmTimer=null;}
  const request=tenantRequest,hash=paidHash;
  let result:VerifyResult|null=null;
  try{result=await verifyNimTransaction({hash,recipient:request.recipient,memo:request.memo,amountLuna:request.amountLuna});}
  catch{result=null;}
  if(payState!=='sent'||paidHash!==hash)return;
  confirmPolls++;
  if(result?.state==='FINAL_MATCHED'){
    payState='confirmed';payMessage='';receiptResult=result;
    rememberPayment(request.chargeId,'confirmed',hash);
    recordProof(request.chargeId,result);
  }else if(result?.state==='REVIEW_REQUIRED'){
    payMessage='The network shows this transaction but it does not match the request exactly. Contact your landlord with the transaction hash.';
  }else{
    payMessage=result?.state==='INCLUDED_NOT_FINAL'?'In a block, waiting for finality…':confirmPolls>3?'Still waiting for the network. You can leave and come back: your payment is remembered.':'';
    if(confirmPolls<60)confirmTimer=setTimeout(()=>void pollConfirmation(),confirmPolls<10?6000:15000);
  }
  render();
}
root.addEventListener('click',e=>{
  const target=e.target as HTMLElement;
  if(target.closest('a[href="/"]'))return;
});
render();
if(publicAudit)void onAuditRecheck();
if(tenantRequest&&payState==='sent'&&paidHash)void pollConfirmation();

async function onConnectWallet():Promise<void>{
  if(walletBusy)return;
  walletBusy=true;render();
  try{const w=await connectWallet();saveLandlordWallet(w);success('Signed in with your Nimiq Pay wallet.');}
  catch(err){walletBusy=false;error(err instanceof Error?err.message:'Could not connect Nimiq Pay.');return;}
  walletBusy=false;render();
}
async function onCreateCharge(form:HTMLFormElement):Promise<void>{
  let charge:Charge;
  try{
    const amountLuna=parseNim(formValue(form,'amount'));
    const issue=payableAmountIssue(amountLuna);if(issue)throw Error(issue);
    const typed=formValue(form,'recipient');
    const recipient=typed||landlordWallet||'';
    if(!isValidNimiqAddress(recipient))throw Error(typed||!landlordWallet?'That Nimiq address is not valid. Check it for typos.':'Connect Nimiq Pay or enter a receiving address.');
    const unitId=formValue(form,'unitId');
    const unit=portfolio.units.find(u=>u.id===unitId);
    const property=portfolio.properties.find(x=>x.id===unit?.propertyId);
    const title=unit&&property?`${property.name} · ${unit.label}`.slice(0,80):undefined;
    const id=randomId();
    charge={id,unitId,period:formValue(form,'period'),amountLuna,recipient,memo:makeMemo(id),createdAt:new Date().toISOString(),...(title?{title}:{})};
    safePersist(addCharge(portfolio,charge));
  }catch(err){error(explainHostError(err));return;}
  if(landlordWallet&&inNimiqPay&&sameAddress(charge.recipient,landlordWallet)){
    await onSignCharges([charge.id]);
  }else success('Rent request created. Tap "Send" to share it with your tenant.');
}
async function onSignCharges(ids:string[]):Promise<void>{
  let signed=0;
  for(const id of ids){
    const charge=portfolio.charges.find(c=>c.id===id);
    if(!charge||preview)continue;
    try{
      const {signed:sig}=await signWithWallet(rentRequestMessage(charge),charge.recipient);
      safePersist(setChargeSignature(portfolio,charge.id,sig));signed++;
    }catch(err){
      error((ids.length>1?`Stopped after ${signed} signed. `:'Request saved but not signed. ')+(err instanceof Error?err.message:'Signing failed.'));
      return;
    }
  }
  if(signed)success(signed===1?'Request created and signed with your wallet. Tap "Send" to share it.':`${signed} requests signed.`);
}
async function onSharePaidProof():Promise<void>{
  if(!tenantRequest||!paidHash||payState!=='confirmed'||shareBusy)return;
  const request=tenantRequest,hash=paidHash;
  let entry=entryFor(tenantMemory,request.chargeId);
  if(!entry?.payment?.claim){
    shareBusy=true;render();
    try{
      const {signed,signer}=await signWithWallet(paymentClaimMessage(request.memo,hash));
      persistTenant({...setPayment(tenantMemory,request.chargeId,{state:'confirmed',hash,at:new Date().toISOString(),claim:signed}),wallet:signer.replace(/\s+/g,'')});
      entry=entryFor(tenantMemory,request.chargeId);
    }catch{/* share an unsigned proof: the landlord sees "payer not identified" */}
    shareBusy=false;render();
  }
  const url=auditUrl(window.location.origin,window.location.pathname,tenantAudit(request,hash));
  await shareOrCopy(url,`Rent ${monthLabel(request.period)} paid: ${formatNim(request.amountLuna)} NIM. Proof on Nimiq mainnet:`,'Proof link copied. Send it to your landlord.');
}
async function onPrintTenantReceipt():Promise<void>{
  if(!tenantRequest||!paidHash)return;
  if(!receiptResult){
    try{receiptResult=await verifyNimTransaction({hash:paidHash,recipient:tenantRequest.recipient,memo:tenantRequest.memo,amountLuna:tenantRequest.amountLuna});}catch{receiptResult=null;}
    if(receiptResult?.state!=='FINAL_MATCHED'){receiptResult=null;error('Could not reach Nimiq mainnet to build the receipt. Try again.');return;}
    render();
  }
  setTimeout(()=>window.print(),50);
}

/**
 * Finds rent payments sent to this landlord's receiving addresses: lists recent incoming
 * transfers carrying an RR1 reference, matches them to requests, and credits each one only
 * after the full on-chain check (recipient, amount, reference, execution, finality).
 */
async function onSyncPayments(quiet=false):Promise<void>{
  if(syncBusy||preview||!portfolio.charges.length)return;
  syncBusy=true;if(!quiet)syncMessage='';render();
  let found=0,partial=0,failed=false;
  try{
    const recipients=[...new Set(portfolio.charges.map(c=>c.recipient.replace(/\s+/g,'').toUpperCase()))].slice(0,10);
    const known=new Set(storedProofs.map(p=>p.hash));
    for(const address of recipients){
      let candidates;
      try{candidates=await findIncomingRentPayments(address);}catch{failed=true;continue;}
      for(const c of candidates){
        if(known.has(c.hash))continue;
        const charge=portfolio.charges.find(x=>x.memo===c.memo&&x.recipient.replace(/\s+/g,'').toUpperCase()===address);
        if(!charge)continue;
        const result=await verifyNimTransaction({hash:c.hash,recipient:charge.recipient,memo:charge.memo,amountLuna:charge.amountLuna,allowPartial:true});
        if(recordProof(charge.id,result)==='ADDED'){found++;known.add(c.hash);if((result.amountLuna??0)<charge.amountLuna)partial++;}
      }
    }
    lastSyncAt=new Date().toISOString();
    syncMessage=failed&&!found?'Could not reach Nimiq mainnet. Try again in a moment.':found?`${found} new payment${found===1?'':'s'} found and confirmed${partial?` (${partial} partial)`:''}.`:'Up to date: no new rent payments.';
  }catch{syncMessage='Could not reach Nimiq mainnet. Try again in a moment.';}
  finally{syncBusy=false;render();}
}
if(!tenantRequest&&!publicAudit&&!publicAuditError&&portfolio.charges.length)setTimeout(()=>void onSyncPayments(true),800);

async function onCreateLease(form:HTMLFormElement):Promise<void>{
  let lease:Lease;
  try{
    if(!landlordWallet)throw Error('Connect Nimiq Pay first.');
    const amountLuna=parseNim(formValue(form,'amount'));
    const issue=payableAmountIssue(amountLuna);if(issue)throw Error(issue);
    const unitId=formValue(form,'unitId');
    const unit=portfolio.units.find(u=>u.id===unitId);const property=portfolio.properties.find(x=>x.id===unit?.propertyId);
    if(!unit)throw Error('Choose a unit.');
    if(leases.some(l=>l.unitId===unitId))throw Error('This unit already has a lease.');
    lease=validateLease({v:1,id:randomId(),recipient:landlordWallet,amountLuna,start:formValue(form,'start'),dueDay:Number(formValue(form,'dueDay')),unitId,...(property?{title:`${property.name} · ${unit.label}`.slice(0,80)}:{})});
  }catch(err){error(explainHostError(err));return;}
  if(inNimiqPay){
    try{const {signed}=await signWithWallet(leaseMessage(publicLease(lease)),lease.recipient);lease={...lease,sig:signed};}
    catch(err){error('Lease saved but not signed. '+(err instanceof Error?err.message:''));}
  }
  try{
    saveLeases([...leases,lease]);
    if(lease.unitId)try{const next={...dueDays,[lease.unitId]:lease.dueDay};localStorage.setItem(DUE_STORAGE_KEY,JSON.stringify(next));dueDays=next;}catch{/* optional */}
    const created=generateLeaseCharges();
    success(`Lease created${lease.sig?' and signed':''}. ${created} monthly request${created===1?'':'s'} ready. Tap "Send lease link".`);
  }catch(err){error(explainHostError(err));}
}
async function onSignLease(id:string):Promise<void>{
  const l=leases.find(x=>x.id===id);if(!l)return;
  try{const {signed}=await signWithWallet(leaseMessage(publicLease(l)),l.recipient);saveLeases(leases.map(x=>x.id===id?{...x,sig:signed}:x));success('Lease signed.');}
  catch(err){error(err instanceof Error?err.message:'Signing failed.');}
}
async function onShareLease(id:string):Promise<void>{
  const l=leases.find(x=>x.id===id);if(!l)return;
  const months=leaseMonths(l,currentPeriod());
  const period=months.length?months[months.length-1]:l.start;
  const url=new URL(window.location.pathname,window.location.origin);
  url.searchParams.set('pay',encodeRequest(leaseRequest(l,period)));
  await shareOrCopy(url.toString(),`Your monthly rent on RentRail${l.title?` (${l.title})`:''}: ${formatNim(l.amountLuna)} NIM, due on day ${l.dueDay}. Open in Nimiq Pay:`,'Lease link copied. Send it to your tenant once: every month will appear in their app.');
}
{
  const created=generateLeaseCharges();
  const before=tenantMemory;
  if(!tenantRequest)refreshTenantLeaseMonths();
  if(created||before!==tenantMemory)render();
}
