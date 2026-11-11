import './styles.css';
import {compareIndependentRecipient} from './recipient-crosscheck.ts';
import {illustrateRentNim} from './fiat-context.ts';
import { monthSnapshot, nextMonth, planNextPeriod } from './operations.ts';
import { journeySteps,validAudience,parseManualPaymentReview,describeManualProof,statusExplanations,type Audience,type ManualPaymentReviewFields } from './journey.ts';
import { collectionQueue,collectionCsv,reminderDraft,validDueDay,type DueDays } from './collections.ts';
import { isValidNimiqAddress, formatNimiqAddress } from './address-validation.ts';
import { createPaymentAudit, decodePaymentAudit, auditUrl, type PublicPaymentAudit } from './audit.ts';
import { verifyNimTransaction, type VerifyResult } from './rpc.ts';
import { addProof, evidenceByCharge, parseProofs, removeProof, PROOF_STORAGE_KEY, type StoredProof } from './proof-store.ts';
import { payableAmountIssue } from './amount-rules.ts';
import { payRentRequest, payButtonLabel, PayError } from './payment.ts';
import {
  addCharge, addProperty, addUnit, createId, emptyPortfolio, formatNim, makeMemo,
  parseNim, projectCharge, recordSubmission, shareableRequest, validateSharedRequest,
  type Charge, type Portfolio, type SharedRequest, type ChargeViewStatus, type TransferEvidence,
} from './domain.ts';
import { loadPortfolio, savePortfolio } from './storage.ts';
import { explainHostError } from './host.ts';
import { getHostNetwork } from '@nimiq/mini-app-sdk';
import { createBackup, restoreBackup } from './backup.ts';

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
function recordProof(chargeId:string,result:VerifyResult):'ADDED'|'ALREADY_RECORDED'|'USED_BY_OTHER_CHARGE'|'NOT_RECORDED'{
  if(preview||result.state!=='FINAL_MATCHED'||typeof result.amountLuna!=='number'||!portfolio.charges.some(c=>c.id===chargeId))return 'NOT_RECORDED';
  const {proofs,outcome}=addProof(storedProofs,{chargeId,hash:result.hash,amountLuna:result.amountLuna,verifiedAt:result.observedAt});
  if(outcome==='ADDED')persistProofs(proofs);
  return outcome;
}
const DEMO_PAID_HASH='d'.repeat(64);
function proofEvidence(p:Portfolio):Record<string,TransferEvidence[]>{
  if(preview){
    const paid=p.charges[0];
    return paid?{[paid.id]:[{network:'nimiq-mainnet',hash:DEMO_PAID_HASH,recipient:paid.recipient,memo:paid.memo,amountLuna:paid.amountLuna,status:'FINAL_VERIFIED'}]}:{};
  }
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

// Tenant payment state. A sent payment is remembered per request on this device so the
// tenant is never invited to pay the same month twice by accident.
type PayState='idle'|'paying'|'sent'|'confirmed'|'unknown';
let payState:PayState='idle';
let payMessage='';
let paidHash:string|null=null;
let confirmPolls=0;
let confirmTimer:ReturnType<typeof setTimeout>|null=null;
function paymentKey(id:string):string{return `rentrail-tenant-payment-${id}`;}
function rememberPayment(id:string,state:PayState,hash:string|null):void{
  try{localStorage.setItem(paymentKey(id),JSON.stringify({state,hash,at:new Date().toISOString()}));}catch{/* the wallet history remains the source of truth */}
}

const search = new URLSearchParams(window.location.search);
if (search.has('audit')) {
  try {publicAudit = decodePaymentAudit(search.get('audit') || '');}
  catch(error){publicAuditError=error instanceof Error?error.message:'Invalid verification link.';}
} else if (search.has('pay')) {
  try {
    tenantRequest = decodeRequest(search.get('pay') || '');
    const prior = localStorage.getItem(paymentKey(tenantRequest.chargeId));
    if (prior) {
      const item = JSON.parse(prior) as {state?:string,hash?:string|null};
      const hash=typeof item.hash==='string'&&/^[0-9a-f]{64}$/.test(item.hash)?item.hash:null;
      if((item.state==='sent'||item.state==='confirmed')&&hash){paidHash=hash;tenantHash=hash;payState=item.state;}
      else if(item.state==='unknown'){payState='unknown';}
    }
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
function demoPortfolio(): Portfolio {
  const now = new Date().toISOString();
  let p = emptyPortfolio();
  p = addProperty(p, { id:'11111111111111111111111111111111', name:'Cedar House (example)', createdAt:now });
  p = addProperty(p, { id:'22222222222222222222222222222222', name:'Riverside (example)', createdAt:now });
  for (const u of [
    { id:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', propertyId:p.properties[0].id, label:'Unit A-101' },
    { id:'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', propertyId:p.properties[0].id, label:'Unit A-102' },
    { id:'cccccccccccccccccccccccccccccccc', propertyId:p.properties[1].id, label:'Unit B-201' },
  ]) p = addUnit(p, u);
  for (const [i,u] of p.units.entries()) {
    const id = String(i+1).repeat(32);
    p = addCharge(p, {
      id, unitId:u.id, period:currentPeriod(), amountLuna:parseNim(i===2?'0.75':i===1?'2.5':'1.25'),
      recipient:'NQ07 0000 0000 0000 0000 0000 0000 0000 0000', memo:makeMemo(id), createdAt:now,
    });
  }
  return p;
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
  return `<div class="wallet-state"><span class="status-light ${inNimiqPay?'online':''}"></span><span>${inNimiqPay?'In Nimiq Pay':'Open in Nimiq Pay to pay'}</span></div>`;
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
  const evidence=proofEvidence(p);
  const snap=monthSnapshot(p,workspaceMonth,'',evidence);
  const chargeCards = p.charges.slice().reverse().slice(0,6).map(c=>chargeRow(p,c,evidence)).join('');
  const opener=`<div class="welcome"><div><div class="eyebrow">RENT ON NIMIQ PAY</div><h1>Send the rent request. <em>See it paid on-chain.</em></h1><p>Monthly rent requests for each unit, paid in NIM inside Nimiq Pay, and confirmed on Nimiq mainnet. Non-custodial: funds go straight from tenant to landlord.</p></div><div class="welcome-symbol">${icon('layers')}</div></div>
    ${guidedJourney(p)}`;
  if(audience==='tenant')return opener+statusGuide();
  return `${opener}
    <div class="metric-grid">
      <div class="metric"><div class="metric-top"><span>Requested · ${escapeHtml(workspaceMonth)}</span>${icon('receipt')}</div><strong>${formatNim(snap.expectedLuna)} <small>NIM</small></strong><span class="metric-foot">${snap.charges} request${snap.charges===1?'':'s'} this month</span></div>
      <div class="metric"><div class="metric-top"><span>Paid on-chain</span>${icon('check')}</div><strong>${formatNim(snap.paidLuna)} <small>NIM</small></strong><span class="metric-foot">${snap.paidCount} of ${snap.charges} fully paid</span></div>
      <div class="metric"><div class="metric-top"><span>Still due</span>${icon('clock')}</div><strong>${formatNim(snap.outstandingLuna)} <small>NIM</small></strong><span class="metric-foot">Across ${p.units.length} unit${p.units.length===1?'':'s'}</span></div>
    </div>
    ${periodCockpit(p)}
    <section class="section"><div class="section-heading"><div><div class="eyebrow">YOUR LEDGER</div><h2>Recent rent requests</h2></div><button class="tertiary" data-nav="charges">View all ${icon('arrow')}</button></div>
      ${chargeCards || emptyState('No rent requests yet','Add a property and a unit, then create your first monthly rent request.','properties','Add a property')}
    </section>
    ${statusGuide()}`;
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
    <div class="period-actions"><button class="tertiary" data-nav="charges" type="button">Manage this month ${icon('arrow')}</button></div>
  </section>`;
}
function renewalPlanner(p:Portfolio):string {
  const source=p.charges.filter(c=>c.period===workspaceMonth);
  const next=nextMonth(workspaceMonth);
  const eligible=source.filter(c=>!p.charges.some(x=>x.unitId===c.unitId&&x.period===next));
  const matches=nextPeriodPreview?.period===workspaceMonth && nextPeriodPreview.count===eligible.length;
  return `<section class="renewal-panel" aria-label="Next-month invoice planner">
    <div class="eyebrow">NEXT MONTH</div>
    <h2>Prepare the next month</h2>
    <p>Copy every ${escapeHtml(workspaceMonth)} request into ${escapeHtml(next)} in one step. Each new request gets a new RR1 reference.</p>
    <div class="period-filters"><label>Source month<input id="renewal-month" type="month" value="${escapeHtml(workspaceMonth)}"/></label></div>
    <div class="renewal-stats"><strong>${eligible.length}</strong> request${eligible.length===1?'':'s'} to create · ${source.length-eligible.length} already exist for ${escapeHtml(next)}</div>
    <div class="renewal-actions">
      <button id="preview-renewal" class="tertiary" type="button" ${preview||eligible.length===0?'disabled':''}>Preview</button>
      ${matches?`<button id="confirm-renewal" class="primary" type="button" ${preview?'disabled':''}>Create ${eligible.length} request${eligible.length===1?'':'s'} ${icon('arrow')}</button>`:''}
    </div>
    ${matches?'<p class="inline-alert">Only ${escapeHtml(next)} is created. Existing requests are kept.</p>':''}
  </section>`;
}
function emptyState(title:string, description:string, goto:View, action:string):string {
  return `<div class="empty"><div class="empty-icon">${icon('building')}</div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(description)}</p><button class="primary" type="button" data-nav="${goto}">${escapeHtml(action)} ${icon('arrow')}</button></div>`;
}
function chargeRow(p:Portfolio,c:Charge,evidence:Record<string,TransferEvidence[]>=proofEvidence(p)):string {
  const unit = p.units.find(u=>u.id===c.unitId);
  const property = p.properties.find(b=>b.id===unit?.propertyId);
  const calculated=projectCharge(c,evidence[c.id]??[],p.submissions);
  const due=calculated.status==='PARTIALLY_FUNDED'?`<small class="due-note">${formatNim(calculated.dueLuna)} NIM left</small>`:'';
  return `<div class="charge-row"><div class="charge-avatar">${icon('home')}</div><div class="charge-title"><b>${normalizeLabel(unit?.label||'Unknown unit')}</b><span>${normalizeLabel(property?.name||'Unknown property')} · ${escapeHtml(c.period)}</span></div><div class="charge-amount"><strong>${formatNim(c.amountLuna)} NIM</strong><span class="tag ${statusClass(calculated.status)}">${statusText(calculated.status)}</span>${due}</div><button class="tiny" type="button" data-share="${escapeHtml(c.id)}" ${preview?'disabled title="Sample data cannot be shared"':''}>${icon('link')}<span> Send link</span></button></div>`;
}
function propertiesView(p:Portfolio):string {
  const cards=p.properties.map(property=>{
    const units=p.units.filter(u=>u.propertyId===property.id);
    return `<div class="property-card"><div class="property-head"><span class="property-icon">${icon('building')}</span><div><strong>${normalizeLabel(property.name)}</strong><span>${units.length} unit${units.length===1?'':'s'}</span></div></div><div class="property-units">${units.map(u=>`<span class="unit-pill">${normalizeLabel(u.label)}</span>`).join('')||'<span class="hint">No units yet</span>'}</div></div>`;
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
  return `<div class="page-title"><div><div class="eyebrow">RENT REQUESTS</div><h1>Monthly <em>rent requests.</em></h1><p>One request per unit and month. Send the link, your tenant pays in Nimiq Pay.</p></div></div>
  <div class="two-col"><section class="panel"><h3>New rent request</h3><form id="charge-form" class="form-stack">
    <label>Unit<select name="unitId" required>${p.units.map(u=>`<option value="${escapeHtml(u.id)}">${normalizeLabel(p.properties.find(b=>b.id===u.propertyId)?.name||'')} / ${normalizeLabel(u.label)}</option>`).join('')}</select></label>
    <div class="form-duo"><label>Month<input name="period" type="month" value="${currentPeriod()}" required /></label><label>Amount (NIM)<input name="amount" inputmode="decimal" placeholder="1250.00" required /></label></div>
    <label>Your Nimiq receiving address<textarea name="recipient" rows="2" placeholder="NQ.." spellcheck="false" required></textarea></label>
    <p class="form-hint">Up to 2 decimals. The public payment reference is a random RR1 code: no names or addresses go on-chain.</p>
    <button class="primary" type="submit" ${preview||!p.units.length?'disabled':''}>${icon('plus')} Create request</button>
  </form></section><section class="stack"><div class="section-heading"><h2>Requests</h2><span class="count">${p.charges.length}</span></div>${p.charges.length?p.charges.slice().reverse().map(c=>chargeRow(p,c)).join(''):emptyState('No rent requests yet','Add a property and a unit first.','properties','Add a property')}</section></div>
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
  const text=JSON.stringify(r);
  return btoa(text).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'');
}
function decodeRequest(encoded:string):SharedRequest {
  if (!/^[a-z0-9_-]{1,1600}$/i.test(encoded)) throw new Error('This payment link is malformed.');
  const base64=encoded.replace(/-/g,'+').replace(/_/g,'/');
  const text=atob(base64);
  return validateSharedRequest(JSON.parse(text));
}
function tenantPaySection(request:SharedRequest):string{
  const amountIssue=payableAmountIssue(request.amountLuna);
  const addressOk=isValidNimiqAddress(request.recipient);
  if(payState==='confirmed'&&paidHash)return `<div class="pay-success" role="status"><div class="pay-success-icon">${icon('check')}</div><strong>Paid ✓ confirmed on-chain</strong><p>${formatNim(request.amountLuna)} NIM for ${escapeHtml(request.period)} reached the landlord's address with this month's reference, finalized on Nimiq mainnet.</p>
    <button id="tenant-share-proof" class="primary full" type="button">${icon('link')} Send proof to my landlord</button>
    <small class="mono">Tx ${escapeHtml(paidHash.slice(0,16))}…</small></div>`;
  if(payState==='sent'&&paidHash)return `<div class="pay-progress" role="status">
    <div class="pay-step done">${icon('check')}<span>Approved in Nimiq Pay</span></div>
    <div class="pay-step active"><span class="spinner" aria-hidden="true"></span><span>Confirming on Nimiq mainnet… usually about a minute</span></div>
    ${payMessage?`<p class="form-hint">${escapeHtml(payMessage)}</p>`:''}
    <button id="tenant-recheck" class="tertiary full" type="button">Check again now</button>
    <small class="mono">Tx ${escapeHtml(paidHash.slice(0,16))}…</small></div>`;
  if(payState==='unknown')return `<div class="inline-alert" role="alert">${icon('alert')}<div><strong>We couldn't confirm what happened.</strong> Open your Nimiq Pay history before paying again. ${escapeHtml(payMessage)}<br/><button id="tenant-reset-payment" class="tertiary" type="button">I checked: nothing was sent, try again</button></div></div>`;
  const blocked=amountIssue||(!addressOk?'The receiving address is invalid. Ask your landlord for a new link.':null);
  return `${blocked?`<div class="inline-alert" role="alert">${icon('alert')} ${escapeHtml(blocked)}</div>`:''}
    <button id="send-payment" class="primary full pay-button" type="button" ${blocked||payState==='paying'?'disabled':''}>${payState==='paying'?'Waiting for Nimiq Pay…':escapeHtml(payButtonLabel(request))}</button>
    ${payMessage?`<div class="inline-alert" role="status">${escapeHtml(payMessage)}</div>`:''}
    <p class="pay-note">You confirm the payment in Nimiq Pay. RentRail never holds your funds or keys.</p>`;
}
function tenantView(request:SharedRequest):string {
  const addressOk=isValidNimiqAddress(request.recipient);
  return `<div class="checkout"><div class="checkout-head"><div class="eyebrow">RENT REQUEST</div><h1>${escapeHtml(monthLabel(request.period))} <em>rent.</em></h1><p>Sent to you with RentRail. Check the details, then pay with Nimiq Pay.</p></div>
  <div class="checkout-card"><span class="checkout-label">Amount due</span><div class="checkout-value">${formatNim(request.amountLuna)} <span>NIM</span></div><div class="hr"></div>
    <div class="detail"><span>Month</span><strong>${escapeHtml(request.period)}</strong></div>
    <div class="detail"><span>Pay to</span><strong class="mono">${escapeHtml(addressOk?formatNimiqAddress(request.recipient):request.recipient)}</strong></div>
    <div class="detail"><span>Reference</span><strong class="mono">${escapeHtml(request.memo.slice(0,14))}…</strong></div>
    <div class="address-check ${addressOk?'ok':'bad'}" role="status">${addressOk?'✓ Valid Nimiq address. Make sure it is your landlord\'s.':'✗ Invalid address: do not pay.'}</div>
    <details class="crosscheck"><summary>Compare with the address your landlord gave you</summary>
      <form id="recipient-crosscheck-form" class="form-stack"><label>Address from your landlord<textarea name="confirmedRecipient" rows="2" maxlength="80" spellcheck="false" autocomplete="off" required placeholder="NQ.."></textarea></label><button class="tertiary" type="submit">Compare</button></form>
      ${tenantRecipientComparison?`<div role="status" class="inline-alert">${escapeHtml(tenantRecipientComparison)}</div>`:''}
      <p class="form-hint">Links can be forwarded and edited, so if in doubt, confirm the address with your landlord directly.</p>
    </details>
    ${tenantPaySection(request)}
  </div>${tenantEvidencePanel(request)}<p class="checkout-foot">RentRail · non-custodial rent requests on Nimiq. <a href="/">Open RentRail</a></p></div>`;
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
function independentAuditView(audit:PublicPaymentAudit):string {
  const r=audit.request;
  const status=publicAuditResult?verifyResultCard(publicAuditResult,r.amountLuna):`<div class="verify-result pending" role="status"><strong>${publicAuditBusy?'Checking Nimiq mainnet…':'Not checked yet'}</strong></div>`;
  const known=portfolio.charges.some(c=>c.id===r.chargeId);
  return `<div class="checkout evidence-checkout"><div class="checkout-head"><div class="eyebrow">RENT PAYMENT PROOF</div><h1>${escapeHtml(monthLabel(r.period))} <em>rent proof.</em></h1><p>This link is checked live against Nimiq mainnet on your device. Nobody has to be trusted.</p></div>
  <section class="checkout-card">
    <span class="checkout-label">Requested</span>
    <div class="checkout-value">${formatNim(r.amountLuna)} <span>NIM</span></div>
    <div class="hr"></div>
    <div class="detail"><span>Pay to</span><strong class="mono">${escapeHtml(isValidNimiqAddress(r.recipient)?formatNimiqAddress(r.recipient):r.recipient)}</strong></div>
    <div class="detail"><span>Reference</span><strong class="mono">${escapeHtml(r.memo.slice(0,14))}…</strong></div>
    <div class="detail"><span>Transaction</span><strong class="mono">${escapeHtml(audit.txHash.slice(0,16))}…</strong></div>
    ${status}
    ${publicAuditRecorded?`<p class="inline-alert ok-alert" role="status">${escapeHtml(publicAuditRecorded)}</p>`:known?'':'<p class="form-hint">Landlord: open this link on the device that holds your RentRail ledger and the request is marked paid automatically.</p>'}
    <button id="audit-recheck" class="tertiary full" ${publicAuditBusy?'disabled':''} type="button">${publicAuditBusy?'Checking…':'Check again'} ${icon('arrow')}</button>
    <a class="tertiary" href="/">Open RentRail</a>
  </section></div>`;
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
  if(!tenantRequest&&!tenantError&&!publicAudit&&!publicAuditError&&!p.properties.length&&selectedView==='overview'&&!preview) {
    const empty = document.createElement('div');
    empty.className='start-banner';
    empty.innerHTML=`<strong>New here?</strong><p>Open a sample portfolio to see paid, partly paid and late rent, or add your first property.</p><button id="preview-demo" class="secondary" type="button">Open sample ${icon('arrow')}</button>`;
    root!.querySelector('.journey-shell')?.after(empty);
  }
  bindEvents();
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
  chargeForm?.addEventListener('submit',e=>{e.preventDefault();try{
    const amountLuna=parseNim(formValue(chargeForm,'amount'));
    const issue=payableAmountIssue(amountLuna);if(issue)throw Error(issue);
    const recipient=formValue(chargeForm,'recipient');
    if(!isValidNimiqAddress(recipient))throw Error('That Nimiq address is not valid. Check it for typos.');
    const id=randomId(); const charge:Charge={id,unitId:formValue(chargeForm,'unitId'),period:formValue(chargeForm,'period'),amountLuna,recipient,memo:makeMemo(id),createdAt:new Date().toISOString()};
    safePersist(addCharge(portfolio,charge));success('Rent request created. Tap "Send link" to share it with your tenant.');
  }catch(err){error(explainHostError(err));}});
  root!.querySelectorAll<HTMLButtonElement>('[data-share]').forEach(button=>button.addEventListener('click',async()=>{
    const charge=portfolio.charges.find(c=>c.id===button.dataset.share);
    if(!charge||preview)return;
    const url=new URL(window.location.pathname,window.location.origin);
    url.searchParams.set('pay',encodeRequest(shareableRequest(charge)));
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
    downloadFile('rentrail-backup-'+localDay()+'.json',createBackup(portfolio,storedProofs,dueDays),'application/json');
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
      success('Backup restored.');
    }catch(err){error(err instanceof Error?err.message:'Could not restore this file.');}
  });
  root!.querySelectorAll<HTMLButtonElement>('[data-reminder]').forEach(btn=>btn.addEventListener('click',async()=>{
    const q=collectionQueue(activePortfolio(),localDay(),dueDays,collectionsPropertyFilter,proofEvidence(activePortfolio()));
    const line=q.lines.find(x=>x.chargeId===btn.dataset.reminder);
    if(!line||preview)return;
    const charge=portfolio.charges.find(c=>c.id===line.chargeId);
    let draft=reminderDraft(line);
    if(charge){const url=new URL(window.location.pathname,window.location.origin);url.searchParams.set('pay',encodeRequest(shareableRequest(charge)));draft+=`\nPay in Nimiq Pay: ${url.toString()}`;}
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
  root!.querySelector('#tenant-share-proof')?.addEventListener('click',()=>void onCopyAudit('paid'));
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
    try{localStorage.removeItem(paymentKey(tenantRequest.chargeId));}catch{/* nothing stored */}
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
      const outcome=recordProof(charge.id,publicAuditResult);
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
    payState='confirmed';payMessage='';
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
