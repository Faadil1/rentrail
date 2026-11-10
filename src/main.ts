import './styles.css';
import {createWorkspaceBackup,readWorkspaceBackup,backupSummary,type PortableWorkspace} from './workspace-portability.ts';
import {buildCollectionQueue} from './collections-queue.ts';
import {loadCasebook,persistCasebook,saveObservedMatch,casebookSummary} from './evidence-casebook.ts';
import { monthSnapshot, nextMonth, planNextPeriod } from './operations.ts';
import { assessSmokePayment, SMOKE_MAX_LUNA, type SmokeAssessment } from './smoke-gate.ts';
import { isValidNimiqAddress } from './address-validation.ts';
import { checkPilotRequest,PILOT_LUNA,type PilotConfig } from './pilot-guard.ts';
import { inspectWalletAddresses, receivingAddressAssessment, type WalletPreflight } from './wallet-preflight.ts';
import { createPaymentAudit, decodePaymentAudit, auditUrl, type PublicPaymentAudit } from './audit.ts';
import { checkPublicMainnetRpc, verifyNimTransaction, type VerifyResult, type RpcNetworkCheck } from './rpc.ts';
import {
  addCharge, addProperty, addUnit, createId, emptyPortfolio, formatNim, makeMemo,
  parseNim, projectCharge, recordSubmission, shareableRequest, validateSharedRequest,
  type Charge, type Portfolio, type SharedRequest, type ChargeViewStatus,
} from './domain.ts';
import { loadPortfolio, savePortfolio } from './storage.ts';
import { checkHost, explainHostError, submitUserApprovedPayment, type HostCheck } from './host.ts';

type View = 'overview' | 'properties' | 'charges' | 'wallet';
const root = document.querySelector<HTMLDivElement>('#app');
if (!root) throw new Error('Missing application mount element.');

let portfolio: Portfolio = loadPortfolio();
let preview = false;
let selectedView: View = 'overview';
let workspaceMonth = currentPeriod();
let importCandidate:PortableWorkspace|null=null;
let importError='';
let filterProperty = '';
let nextPeriodPreview: {period:string; count:number; skipped:number; next:string}|null=null;
let publicAudit: PublicPaymentAudit | null = null;
let publicAuditError = '';
let publicAuditBusy = false;
let publicAuditResult: VerifyResult | null = null;
let tenantHash = '';
let tenantVerifyBusy = false;
let tenantVerifyResult: VerifyResult | null = null;
let check: HostCheck | null = null;
let walletSnapshot: WalletPreflight | null = null;
let walletInventoryBusy = false;
let walletInventoryError = '';
let hostStatus: 'unchecked' | 'checking' | 'connected' | 'error' = 'unchecked';
let hostMessage = '';
let rpcChecking = false;
let rpcNetwork: RpcNetworkCheck | null = null;
let txVerifyBusy = false;
let txVerifyResult: VerifyResult | null = null;
let txHashInput = '';
let txChargeId = '';
let txVerifiedChargeId = '';
let toast = '';
let tenantRequest: SharedRequest | null = null;
let tenantError = '';
// Preview is host-connection-only. Never send NIM until a reviewed verifier and human gate exist.
// NEVER enabled in ordinary staging. Separate explicit human approval is required
// before producing any dedicated one-time smoke-test deployment.
const paymentEnabled = import.meta.env.VITE_ENABLE_LIVE_NIM_SEND === 'smoke_test_human_approved';
let paymentBusy = false;
let paymentAcknowledged = false;
let recipientAcknowledged = false;
let realMoneyAcknowledged = false;
let submittedHash: string | null = null;
let outcomeUnknown = false;
// Prevent an accidental duplicate request after reloading a tenant's browser.
// Browser storage is best effort, not a network-wide duplicate-payment lock.
function localPaymentKey(id:string):string{return `rentrail-pending-${id}`;}
function pilotAttemptKey(id:string):string{return `rentrail-500-luna-attempt-${id}`;}
function pilotConfig():PilotConfig{
  return {
    recipient:import.meta.env.VITE_SMOKE_ALLOW_RECIPIENT,
    chargeId:import.meta.env.VITE_SMOKE_ALLOW_CHARGE_ID,
    amountLuna:import.meta.env.VITE_SMOKE_ALLOW_AMOUNT_LUNA,
    period:import.meta.env.VITE_SMOKE_ALLOW_PERIOD
  };
}

const search = new URLSearchParams(window.location.search);
if (search.has('audit')) {
  try {publicAudit = decodePaymentAudit(search.get('audit') || '');}
  catch(error){publicAuditError=error instanceof Error?error.message:'Invalid verification link.';}
} else if (search.has('pay')) {
  try {
    tenantRequest = decodeRequest(search.get('pay') || '');
    const prior = localStorage.getItem(localPaymentKey(tenantRequest.chargeId));
    if(localStorage.getItem(pilotAttemptKey(tenantRequest.chargeId))) outcomeUnknown=true;
    if (prior) {
      const item = JSON.parse(prior) as {status?:string,hash?:string};
      if (item.status==='SUBMITTED_UNVERIFIED') submittedHash = typeof item.hash==='string'?item.hash:null;
      if (item.status==='OUTCOME_UNKNOWN') outcomeUnknown = true;
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
  return ({ OPEN:'Unpaid', SUBMITTED_UNVERIFIED:'Unverified', PARTIALLY_FUNDED:'Partial', PAID_ONCHAIN_VERIFIED:'Chain verified', REVIEW_REQUIRED:'Needs review' })[status];
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
  const description = hostStatus==='connected' ? (check?.consensus ? 'SDK connected' : 'SDK / no consensus') : hostStatus==='checking' ? 'Checking host…' : 'Host not verified';
  return `<div class="wallet-state"><span class="status-light ${hostStatus==='connected'&&check?.consensus?'online':''}"></span><span>${escapeHtml(description)}</span></div>`;
}
function overview(p: Portfolio): string {
  const sum = p.charges.reduce((n,c)=>n+c.amountLuna,0);
  const submitted = p.charges.filter(c=>p.submissions.some(s=>s.chargeId===c.id)).length;
  const chargeCards = p.charges.slice().reverse().slice(0,6).map(c=>chargeRow(p,c)).join('');
  return `<div class="welcome"><div><div class="eyebrow">RENTAL OPERATIONS · NIMIQ PAY</div><h1>Your portfolio, <em>in focus.</em></h1><p>Every rent period tracked. Every payment outcome explained. Built for one property or many.</p></div><div class="welcome-symbol">${icon('layers')}</div></div>
    <div class="metric-grid">
      <div class="metric"><div class="metric-top"><span>Total obligations</span>${icon('receipt')}</div><strong>${formatNim(sum)} <small>NIM</small></strong><span class="metric-foot">Recorded locally · not an on-chain balance</span></div>
      <div class="metric"><div class="metric-top"><span>Active units</span>${icon('home')}</div><strong>${p.units.length}</strong><span class="metric-foot">Across ${p.properties.length} properties</span></div>
      <div class="metric"><div class="metric-top"><span>Unverified sends</span>${icon('clock')}</div><strong>${submitted}</strong><span class="metric-foot">Never counted as rent paid</span></div>
    </div>
    <div class="release-notice"><strong>Public verification edition · Cycle III</strong><p>Organize local rent invoices, check the Nimiq Pay wallet, and verify already-completed NIM payments with a public mainnet history node. <b>This public edition cannot initiate payments.</b> The first user-approved pilot succeeded on-chain but its native wallet dialog rounded 0.005 NIM to 0.01 NIM: that discrepancy remains under investigation.</p><button class="tertiary" data-nav="wallet">Check wallet &amp; verify an existing transfer ${icon('arrow')}</button></div>
    ${periodCockpit(p)}
    <section class="section"><div class="section-heading"><div><div class="eyebrow">YOUR WORKSPACE</div><h2>Recent obligations</h2></div><button class="tertiary" data-nav="charges">View all ${icon('arrow')}</button></div>
      ${chargeCards || emptyState('No rent charges yet','Create a property and unit, then issue your first monthly rent request.','properties','Create a property')}
    </section>
    <div class="safety"><span>${icon('shield')}</span><div><strong>Designed to show what is proven.</strong><p>Sending a transaction never marks an obligation as paid. Independent mainnet reconciliation is a separate required gate.</p></div></div>`;
}
function periodCockpit(p:Portfolio):string {
  const activeFilter=p.properties.some(x=>x.id===filterProperty)?filterProperty:'';
  const snap=monthSnapshot(p,workspaceMonth,activeFilter);
  const options=p.properties.map(x=>`<option value="${escapeHtml(x.id)}" ${activeFilter===x.id?'selected':''}>${escapeHtml(x.name)}</option>`).join('');
  const monthlyLines=snap.lines.slice(0,8).map(line=>`<div class="period-line">
    <div><strong>${escapeHtml(line.unitLabel)}</strong><small>${escapeHtml(line.propertyName)}</small></div>
    <div><strong>${formatNim(line.outstandingLuna)} NIM</strong><small>${line.status==='SUBMITTED_UNVERIFIED'?'Wallet send unverified':'Local obligation; no verified payment'}</small></div></div>`).join('');
  return `<section class="period-cockpit" aria-label="Monthly rental operations">
    <div class="section-heading"><div><div class="eyebrow">MONTHLY OPERATIONS</div><h2>Period cockpit</h2></div><span class="count">Locally recorded, not bank balances</span></div>
    <div class="period-filters"><label>Month<input id="month-filter" type="month" value="${escapeHtml(workspaceMonth)}"/></label>
    <label>Property<select id="property-filter"><option value="">All properties</option>${options}</select></label></div>
    <div class="period-metrics">
      <div><small>Amount requested</small><strong>${formatNim(snap.expectedLuna)} NIM</strong></div>
      <div><small>Unverified outstanding</small><strong>${formatNim(snap.outstandingLuna)} NIM</strong></div>
      <div><small>Units missing an invoice</small><strong>${snap.unitsWithoutCharge} / ${snap.activeUnits}</strong></div>
      <div><small>Wallet sends awaiting proof</small><strong>${snap.awaitingProof}</strong></div>
    </div>
    <div class="period-lines">${monthlyLines||'<div class="empty-period">No invoices for this period or property. Create one in the Rent ledger.</div>'}</div>
    <div class="period-actions"><button class="tertiary" data-nav="charges" type="button">Manage this month ${icon('arrow')}</button><p>Monthly planning uses local invoices only. No rent is marked paid from browser data.</p></div>
  </section>`;
}
function renewalPlanner(p:Portfolio):string {
  const source=p.charges.filter(c=>c.period===workspaceMonth);
  const next=nextMonth(workspaceMonth);
  const eligible=source.filter(c=>!p.charges.some(x=>x.unitId===c.unitId&&x.period===next));
  const matches=nextPeriodPreview?.period===workspaceMonth && nextPeriodPreview.count===eligible.length;
  return `<section class="renewal-panel" aria-label="Next-month invoice planner">
    <div class="eyebrow">REPEAT VALUE · RENTAL CYCLE</div>
    <h2>Prepare the next month</h2>
    <p>Carry forward the amounts and receiving addresses for ${escapeHtml(workspaceMonth)} into ${escapeHtml(next)}. Each new invoice receives a <strong>new opaque public reference</strong>. No payment or reminder is sent.</p>
    <div class="period-filters"><label>Source month<input id="renewal-month" type="month" value="${escapeHtml(workspaceMonth)}"/></label></div>
    <div class="renewal-stats"><strong>${eligible.length}</strong> invoice${eligible.length===1?'':'s'} eligible · ${source.length-eligible.length} already planned for ${escapeHtml(next)}</div>
    <div class="renewal-actions">
      <button id="preview-renewal" class="tertiary" type="button" ${preview||eligible.length===0?'disabled':''}>Review invoices</button>
      ${matches?`<button id="confirm-renewal" class="primary" type="button" ${preview?'disabled':''}>Create ${eligible.length} draft invoice${eligible.length===1?'':'s'} ${icon('arrow')}</button>`:''}
    </div>
    ${matches?'<p class="inline-alert">Review: only the next month is created. Existing invoices are not replaced. This does not request wallet approval or confirm any rent payment.</p>':''}
  </section>`;
}
function emptyState(title:string, description:string, goto:View, action:string):string {
  return `<div class="empty"><div class="empty-icon">${icon('building')}</div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(description)}</p><button class="primary" type="button" data-nav="${goto}">${escapeHtml(action)} ${icon('arrow')}</button></div>`;
}
function chargeRow(p:Portfolio,c:Charge):string {
  const unit = p.units.find(u=>u.id===c.unitId);
  const property = p.properties.find(b=>b.id===unit?.propertyId);
  const calculated=projectCharge(c,[],p.submissions);
  return `<div class="charge-row"><div class="charge-avatar">${icon('home')}</div><div class="charge-title"><b>${normalizeLabel(unit?.label||'Unknown unit')}</b><span>${normalizeLabel(property?.name||'Unknown property')} · ${escapeHtml(c.period)}</span></div><div class="charge-amount"><strong>${formatNim(c.amountLuna)} NIM</strong><span class="tag ${statusClass(calculated.status)}">${statusText(calculated.status)}</span></div><button class="tiny" type="button" data-share="${escapeHtml(c.id)}" ${preview?'disabled title="Example data cannot be shared"':''}>${icon('link')}<span> Request</span></button></div>`;
}
function propertiesView(p:Portfolio):string {
  const cards=p.properties.map(property=>{
    const units=p.units.filter(u=>u.propertyId===property.id);
    return `<div class="property-card"><div class="property-head"><span class="property-icon">${icon('building')}</span><div><strong>${normalizeLabel(property.name)}</strong><span>${units.length} unit${units.length===1?'':'s'} · local record</span></div></div><div class="property-units">${units.map(u=>`<span class="unit-pill">${normalizeLabel(u.label)}</span>`).join('')||'<span class="hint">No units added</span>'}</div></div>`;
  }).join('');
  return `<div class="page-title"><div><div class="eyebrow">PORTFOLIO BUILDER</div><h1>Properties <em>& units.</em></h1><p>One building or an entire portfolio, the same rent ledger.</p></div></div>
  <div class="two-col"><div class="stack"><section class="panel"><h3>Add property</h3><form id="property-form" class="form-stack"><label>Property label<input name="name" maxlength="70" placeholder="e.g. Parkside building" required /></label><button class="primary" ${preview?'disabled':''} type="submit">${icon('plus')} Add property</button></form></section>
  <section class="panel"><h3>Add unit</h3><form id="unit-form" class="form-stack"><label>Property<select name="propertyId" required>${p.properties.map(b=>`<option value="${escapeHtml(b.id)}">${normalizeLabel(b.name)}</option>`).join('')}</select></label><label>Private unit label<input name="label" maxlength="60" placeholder="e.g. A-102" required/></label><button class="primary" type="submit" ${preview||!p.properties.length?'disabled':''}>${icon('plus')} Add unit</button></form></section></div>
  <section class="stack"><div class="section-heading"><h2>Buildings</h2><span class="count">${p.properties.length}</span></div>${cards||emptyState('No properties yet','Add your first building using the form.', 'properties','Get started')}</section></div>
  <p class="footnote">Private labels are held only in this device's local browser storage. Do not treat them as backed up or shared with other users.</p>`;
}
function collectionOperationsPanel(p:Portfolio):string{
 const q=buildCollectionQueue(p,workspaceMonth,filterProperty);
 const view=q.actions.slice(0,12).map(a=>{
  const priority=a.priority==='SUBMITTED_NOT_VERIFIED'?'Verify on-chain':a.priority==='PAST_PERIOD_UNMATCHED'?'Review past month':a.priority==='MISSING_INVOICE'?'Issue monthly request':'Outstanding locally';
  return `<div class="collection-row"><div class="collection-copy"><strong>${escapeHtml(priority)} · ${escapeHtml(a.unitLabel)}</strong><small>${escapeHtml(a.propertyName)} · ${escapeHtml(a.period)}</small><small>${escapeHtml(a.note)}</small></div><div class="collection-amount">${a.chargeId?formatNim(a.amountLuna)+' NIM':'No invoice'}</div></div>`;
 }).join('');
 return `<section class="panel collections-panel" aria-label="Actionable rental operations queue">
   <div class="eyebrow">COLLECTIONS WORKFLOW · NO AUTOMATED DEBITS</div>
   <h3>What needs attention this month?</h3>
   <p>Action queue for the selected period (${escapeHtml(workspaceMonth)}). These are local records, not proof of money owed, lateness or legal delinquency. All amounts remain unmatched unless independently reconciled and acknowledged.</p>
   <div class="collection-metrics"><span><b>${q.missingInvoices}</b> missing invoices</span><span><b>${q.submittedForReview}</b> needs chain review</span><span><b>${q.pastPeriodUnmatched}</b> past periods to review</span><span><b>${q.currentPeriodUnmatched}</b> current unmatched</span></div>
   <div class="collection-list">${view||'<p>No local actions identified for this period.</p>'}</div>
   ${q.totalActions>12?`<small>${q.totalActions-12} more actions not shown. Use month and property filters to narrow the queue.</small>`:''}
   <div class="collection-actions"><button class="tertiary" type="button" data-nav="wallet">Verify transaction proofs ${icon('arrow')}</button></div>
 </section>`;
}
function chainEvidenceCasebook(p:Portfolio):string{
 const journal=loadCasebook(p);
 const rows=p.charges.slice().reverse().map(charge=>{
  const matches=journal.entries.filter(e=>e.chargeId===charge.id);
  if(!matches.length)return '';
  const summary=casebookSummary(journal,p,charge.id);
  const preview=matches.map(e=>`<div class="casebook-line"><span class="mono">${escapeHtml(e.hash.slice(0,12))}…${escapeHtml(e.hash.slice(-8))}</span><span>${formatNim(e.amountLuna)} NIM</span><small>${escapeHtml(e.observedAt.slice(0,16))} UTC · one RPC · block ${e.blockHeight}</small></div>`).join('');
  return `<div class="casebook-entry"><strong>${escapeHtml(charge.period)} · ${escapeHtml(charge.memo.slice(0,13))}…</strong><p>${matches.length} node-reported observation(s), ${formatNim(summary.observedLuna)} NIM total previously matched. ${formatNim(summary.unmatchedLuna)} NIM still unmatched to local invoice by these snapshots. This is not a legal rent receipt.</p>${preview}</div>`;
 }).filter(Boolean).join('');
 return `<section class="panel casebook-panel" aria-label="Historical public-chain observations">
   <div class="eyebrow">PAYMENT EVIDENCE · LOCAL CASEBOOK</div><h3>Chain evidence, saved with its source</h3>
   <p>After independently verifying a hash, you may save the node-reported match for your monthly records. A saved observation retains its amount, date, transaction hash and canonical block heights. It is <strong>not continuously refreshed</strong>, not an ownership proof, and never marks rent legally paid. Recheck the hash before relying on it.</p>
   ${rows||'<div class="empty-period">No node-reported matches saved yet. Verify an existing transfer under Wallet gate, then explicitly save its observation.</div>'}
   <button class="tertiary" type="button" data-nav="wallet">Verify a transaction hash ${icon('arrow')}</button>
 </section>`;
}
function portableWorkspacePanel(p:Portfolio):string {
 const counts=backupSummary(p);
 const restore=importCandidate?backupSummary(importCandidate.portfolio):null;
 return `<section class="panel portable-panel" aria-label="Export and restore your local rental workspace">
   <div class="eyebrow">CONTINUITY · DATA PORTABILITY</div>
   <h3>Keep your rental records across devices</h3>
   <p>Export your local property, unit, monthly charge and unverified-submission records as JSON. Import on another device after reviewing the counts. This is <strong>not a live sync</strong>, not an attested on-chain receipt, and not encrypted. Store copies privately.</p>
   <div class="portable-metrics"><span><b>${counts.properties}</b> properties</span><span><b>${counts.units}</b> units</span><span><b>${counts.charges}</b> charges</span><span><b>${counts.unverified}</b> unverified sends</span></div>
   <button type="button" id="workspace-export" class="tertiary" ${preview?'disabled':''}>Export JSON backup</button>
   <form id="workspace-import" class="form-stack">
     <label>Restore JSON backup<textarea name="backup" rows="3" maxlength="200000" spellcheck="false" autocomplete="off" placeholder="Paste a RentRail workspace JSON export" required></textarea></label>
     <button type="submit" class="tertiary" ${preview?'disabled':''}>Preview import — no changes yet</button>
   </form>
   ${importError?`<div class="inline-alert" role="alert">${escapeHtml(importError)}</div>`:''}
   ${restore?`<div class="import-preview" role="status"><b>Valid workspace snapshot</b><p>${restore.properties} properties · ${restore.units} units · ${restore.charges} rent charges · ${restore.unverified} unverified submissions</p><p>Imported hashes and statuses are never legal payment receipts. Reverify each on-chain transaction independently. Import replaces this device's current local workspace, never merges it.</p><label class="consent"><input type="checkbox" id="restore-ack"> I understand this replaces existing local records and is not proof of payment.</label><button type="button" id="workspace-apply" class="primary" disabled>Replace local workspace with preview</button></div>`:''}
 </section>`;
}
function chargesView(p:Portfolio):string {
  return `<div class="page-title"><div><div class="eyebrow">RENT LEDGER</div><h1>Monthly <em>obligations.</em></h1><p>Requests and partial-payment accounting, without false confirmations.</p></div></div>
  <div class="two-col"><section class="panel"><h3>New rent obligation</h3><form id="charge-form" class="form-stack">
    <label>Unit<select name="unitId" required>${p.units.map(u=>`<option value="${escapeHtml(u.id)}">${normalizeLabel(p.properties.find(b=>b.id===u.propertyId)?.name||'')} / ${normalizeLabel(u.label)}</option>`).join('')}</select></label>
    <div class="form-duo"><label>Period<input name="period" type="month" value="${currentPeriod()}" required /></label><label>Amount in NIM<input name="amount" inputmode="decimal" placeholder="1.25" required /></label></div>
    <label>Landlord's Nimiq receiving address<textarea name="recipient" rows="2" placeholder="NQ..." spellcheck="false" required></textarea></label>
    <p class="form-hint">The memo will be an opaque ID, never a tenant name or address. Amounts here are NIM obligations, not automatic fiat conversions.</p>
    <button class="primary" type="submit" ${preview||!p.units.length?'disabled':''}>${icon('plus')} Create obligation</button>
  </form></section><section class="stack"><div class="section-heading"><h2>Rent requests</h2><span class="count">${p.charges.length}</span></div>${p.charges.length?p.charges.slice().reverse().map(c=>chargeRow(p,c)).join(''):emptyState('No obligations recorded','Create a property and a unit before issuing a request.','properties','Set up property')}</section></div>
  ${collectionOperationsPanel(p)}
  ${chainEvidenceCasebook(p)}
  ${renewalPlanner(p)}
  ${portableWorkspacePanel(p)}
  <div class="safety"><span>${icon('shield')}</span><div><strong>Sending is not settlement.</strong><p>All requests start OPEN. Any wallet-submitted hash remains unverified until independent chain verification is implemented.</p></div></div>`;
}
function walletInventoryPanel():string {
  const data=walletSnapshot;
  const accountRows=data?.accounts.map((a,i)=>{
    const short=`${a.address.slice(0,8)}…${a.address.slice(-7)}`;
    const balance=a.balanceLuna===null?'Unknown · read failed':formatNim(a.balanceLuna)+' NIM reported';
    return `<div class="account-row"><div><small>Shared address ${i+1} — not necessarily the sending address</small><strong class="mono">${escapeHtml(short)}</strong><small>${escapeHtml(balance)}</small></div><button type="button" class="tertiary" data-wallet-copy="${escapeHtml(a.address)}">Copy public address</button></div>`;
  }).join('')||'';
  const warnings=data?.warnings.map(t=>`<p class="account-warning">${escapeHtml(t)}</p>`).join('')||'';
  return `<section class="wallet-inventory" aria-label="Read-only wallet address inspection">
    <div class="eyebrow">G2 · WALLET PREFLIGHT · NO PAYMENT</div>
    <h3>Check your connected wallet</h3>
    <p>Share public Nimiq addresses with this Mini App to check their on-chain balances. Nimiq Pay may ask permission. We do not store these addresses in your rental ledger or send any NIM.</p>
    <button id="wallet-accounts-read" type="button" class="tertiary" ${walletInventoryBusy||hostStatus!=='connected'||check?.network!=='mainnet'?'disabled':''}>${walletInventoryBusy?'Reading your accounts…':'Check my addresses and balances'}</button>
    ${hostStatus!=='connected'||check?.network!=='mainnet'?'<p class="account-warning">First use Check host and confirm MAINNET.</p>':''}
    ${walletInventoryError?`<div class="inline-alert" role="status">${escapeHtml(walletInventoryError)}</div>`:''}
    ${data?`<div class="account-list" role="status">${accountRows}${warnings}<p class="account-note">Balance readings are per address and do not prove the account Nimiq Pay will select to send. The same address cannot pay itself. To test a payment, choose a second independently confirmed NQ recipient that is not one of these shared payer-wallet addresses.</p></div>`:''}
  </section>`;
}
function walletView():string {
  return `<div class="page-title"><div><div class="eyebrow">NIMIQ PAY · HOST GATE</div><h1>Wallet <em>connection.</em></h1><p>Check the actual Mini App provider, not a standalone Safari browser tab.</p></div></div>
  <div class="wallet-panel"><div class="wallet-large">${icon('wallet')}</div><h2>${hostStatus==='connected'?'SDK provider detected':'Connect Nimiq Pay'}</h2><p class="wallet-copy">${hostStatus==='connected' ? (check?.consensus?'Nimiq Pay SDK responded. Its reported wallet network is shown below, separately from public mainnet RPC. Both must be checked before considering any payment.':'Provider found but consensus is not established.') : 'Open this app from Nimiq Pay → Mini Apps to authorize SDK access. Browsers alone do not inject the wallet provider.'}</p>
  <button id="check-host" class="primary" type="button" ${hostStatus==='checking'?'disabled':''}>${hostStatus==='checking'?'Checking…':'Check host'} ${icon('arrow')}</button>
  ${hostStatus==='error'?`<div class="inline-alert">${icon('alert')} ${escapeHtml(hostMessage)}</div>`:''}
  ${hostStatus==='connected'?`<div class="host-report"><div><span>Host provider</span><b>Detected</b></div><div><span>Consensus</span><b>${check?.consensus?'Established':'Unavailable'}</b></div><div><span>Block height</span><b>${check?.blockHeight??'Unknown'}</b></div><div><span>Balance method</span><b>${check?.balanceReadAvailable?'Available':'Missing / old host'}</b></div><div><span>Wallet network (host-reported)</span><b>${escapeHtml((check?.network??'unknown').toUpperCase())}</b></div><div><span>Independent mainnet</span><b>${rpcNetwork?.state==='MAINNET_REPORTED'?'Public RPC only':'Not verified'}</b></div></div>`:''}
  </div>
  ${walletInventoryPanel()}
  <div class="safety"><span>${icon('shield')}</span><div><strong>No automatic transfers or custody.</strong><p>Normal previews cannot initiate wallet payment. A dedicated, human-approved capped mainnet test build would additionally require fresh host + public RPC checks and native confirmation. We never request private keys or equate a hash with final settlement.</p></div></div>`;
}
function g3Panel(p:Portfolio):string {
  const charges = preview ? [] : p.charges;
  const options = charges.map(c=>`<option value="${escapeHtml(c.id)}" ${txChargeId===c.id?'selected':''}>${escapeHtml(c.period)} · ${formatNim(c.amountLuna)} NIM · ${escapeHtml(c.memo.slice(0,13))}…</option>`).join('');
  const networkResult=rpcNetwork ? `<div class="g3-result" role="status"><strong>${rpcNetwork.state==='MAINNET_REPORTED'?'Public RPC reports MainAlbatross':'RPC NOT VERIFIED'}</strong><p>${escapeHtml(rpcNetwork.message)}</p><small>${escapeHtml(rpcNetwork.observedAt)}${rpcNetwork.headHeight?' · Head '+rpcNetwork.headHeight:''}</small></div>` : '';
  const heightWarning=rpcNetwork?.state==='MAINNET_REPORTED' && rpcNetwork.headHeight && check?.blockHeight!==null &&
    check?.blockHeight!==undefined && Math.abs(rpcNetwork.headHeight-check.blockHeight)>10_000
    ? '<div class="inline-alert">The wallet SDK block height differs greatly from this public mainnet node. The wallet may be on another network. Height alone does not establish network identity; do not send funds.</div>' : '';
  const txResult=txVerifyResult && txVerifiedChargeId===txChargeId ? `<div class="g3-result" id="g3-result" role="status"><strong>${txVerifyResult.state==='FINAL_MATCHED'?'Node-reported final match — NOT a rent receipt':escapeHtml(txVerifyResult.state.replaceAll('_',' '))}</strong><p>${escapeHtml(txVerifyResult.message)}</p><small>Tx ${escapeHtml(txVerifyResult.hash)} · ${escapeHtml(txVerifyResult.observedAt)}</small><p>Single public RPC only. No automatic rental ledger credit. Human recipient identity and agreement remain separate.</p></div>` : '';
  return `<section class="g3-panel" aria-label="Read-only mainnet verification">
    <div class="eyebrow">G3 · PUBLIC RPC · READ ONLY</div>
    <h2>Verify independently. <em>Never assume paid.</em></h2>
    <p>The provider detected by Nimiq Pay may be on TESTNET. This panel queries a separate public node reporting MainAlbatross. It cannot prove what network your wallet selected.</p>
    <button id="g3-network" class="tertiary" type="button" ${rpcChecking?'disabled':''}>${rpcChecking?'Checking public RPC…':'Check mainnet RPC connectivity'}</button>
    ${networkResult}
    ${heightWarning}
    <form id="g3-verify-form" class="form-card">
      <label>Local rent obligation<select name="chargeId" required ${!charges.length||txVerifyBusy?'disabled':''}><option value="" ${!txChargeId?'selected':''}>Choose a charge…</option>${options}</select></label>
      <label>Transaction hash (64 hexadecimal characters)<input name="hash" type="text" inputmode="text" maxlength="64" pattern="[a-fA-F0-9]{64}" spellcheck="false" autocomplete="off" placeholder="Paste a real public NIM transaction hash" value="${escapeHtml(txHashInput)}" required ${txVerifyBusy?'disabled':''}/></label>
      <p class="form-hint">Exact recipient, amount, opaque memo, chain execution, canonical block inclusion and a later macroblock are required. One-node results are informational and do not settle a lease.</p>
      <button class="primary" type="submit" ${!charges.length||preview||txVerifyBusy?'disabled':''}>${txVerifyBusy?'Verifying…':'Read chain and verify tuple'} ${icon('arrow')}</button>
    </form>
    ${!charges.length?'<div class="inline-alert">Create an actual local rent obligation before checking a transaction. Fictional example charges are never verified as real.</div>':''}
    ${txResult}
    ${txVerifiedChargeId===txChargeId && txVerifyResult && p.charges.some(x=>x.id===txChargeId)?observedTransferAmount(shareableRequest(p.charges.find(x=>x.id===txChargeId)!),txVerifyResult):''}
    ${txVerifyResult?.state==='FINAL_MATCHED' && txVerifiedChargeId===txChargeId?'<button id="g3-copy-audit" class="tertiary" type="button">Copy independent recheck link</button>':''}
    ${txVerifyResult?.state==='FINAL_MATCHED' && txVerifiedChargeId===txChargeId?'<button id="g3-save-observation" class="tertiary" type="button">Save this RPC-reported match to local casebook</button>':''}
    <small>Saved casebook entries are historical reports from one public node, not fresh chain attestation. Never treat them as legal rent receipts or verified landlord identity.</small>
    <div class="safety"><span>${icon('shield')}</span><div><strong>Payment sends remain locked.</strong><p>Nothing here sends NIM, stores wallet secrets, or marks rent paid automatically.</p></div></div>
  </section>`;
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
function smokeAssessment(request:SharedRequest):SmokeAssessment{
  const safety=assessSmokePayment({
    buildAllowsSmoke:paymentEnabled,
    walletNetwork:check?.network??'unknown',
    consensus:hostStatus==='connected' && check?.consensus===true,
    walletBlockHeight:check?.blockHeight??null,
    hostCheckedAtMs:check?.checkedAtMs??null,
    publicRpcNetwork:rpcNetwork?.state==='MAINNET_REPORTED'?rpcNetwork.network??null:null,
    publicRpcBlockHeight:rpcNetwork?.headHeight??null,
    publicRpcObservedAt:rpcNetwork?.observedAt??null,
    nowMs:Date.now(),amountLuna:request.amountLuna,
    recipientCheckAcknowledged:recipientAcknowledged,
    realMoneyAcknowledged,
    walletApprovalAcknowledged:paymentAcknowledged,
    priorAttemptUnresolved:!!submittedHash||outcomeUnknown||paymentBusy,
    recipient:request.recipient,
    allowlistedRecipient:import.meta.env.VITE_SMOKE_ALLOW_RECIPIENT??null,
    sharedPayerAddresses:walletSnapshot?.accounts.map(x=>x.address)??null,
    memo:request.memo
  });
  const strictPilot=checkPilotRequest(request,pilotConfig());
  return {allowed:safety.allowed&&strictPilot.allowed,reasons:[...safety.reasons,...strictPilot.reasons]};
}
function tenantView(request:SharedRequest):string {
  const gate=smokeAssessment(request);
  const warnings=gate.reasons.filter(x=>x!=='This build is read-only. Payments are disabled.');
  const walletNetwork=check?.network??'unknown';
  const rpcNetworkLabel=rpcNetwork?.state==='MAINNET_REPORTED'?'MainAlbatross':'NOT VERIFIED';
  return `<div class="checkout"><div class="checkout-head"><div class="eyebrow">TENANT PAYMENT REQUEST</div><h1>Rent, with <em>clarity.</em></h1><p>Review these instructions against your trusted landlord contact before moving any NIM.</p></div>
  <div class="checkout-card"><span class="checkout-label">${escapeHtml(request.period)} rent obligation</span><div class="checkout-value">${formatNim(request.amountLuna)} <span>NIM</span></div><div class="hr"></div>
    <div class="detail"><span>Recipient</span><strong class="mono">${escapeHtml(request.recipient)}</strong></div>
    <div class="address-check" role="status">${isValidNimiqAddress(request.recipient)?'NQ checksum valid — recipient ownership is NOT verified.':'WARNING: recipient NQ checksum INVALID — do not send any funds.'}</div>
    <div class="detail"><span>Public memo</span><strong class="mono">${escapeHtml(request.memo)}</strong></div>
    <div class="detail"><span>Reference</span><strong class="mono">${escapeHtml(request.chargeId.slice(0,10))}…</strong></div>
    <div class="inline-alert">${icon('alert')} Link contents can be altered by anyone sharing it. Verify the recipient with your landlord independently. This request does not prove identity or a legal debt.</div>
    <div class="smoke-panel" aria-label="Controlled mainnet test safety">
      <div class="eyebrow">G2 · REAL MONEY SAFETY CHECK</div>
      <h3>One small, controlled transaction</h3>
      <p>This is an approved fictional trial, not residential rent. Only <strong>${formatNim(PILOT_LUNA)} NIM</strong> (500 Luna) to the explicitly authorized wallet B, plus a fee chosen by Nimiq Pay, can be requested. If anything differs in the native dialog, cancel. This browser-local attempt lock is NOT a cross-device spending limit.</p>
      <div class="host-report"><div><span>Wallet network</span><b>${escapeHtml(walletNetwork.toUpperCase())}</b></div><div><span>Independent public RPC</span><b>${escapeHtml(rpcNetworkLabel)}</b></div><div><span>SDK height</span><b>${check?.blockHeight??'Unknown'}</b></div><div><span>RPC height</span><b>${rpcNetwork?.headHeight??'Unknown'}</b></div></div>
      <button class="tertiary full" id="tenant-check-host" type="button" ${hostStatus==='checking'?'disabled':''}>${hostStatus==='connected'?'Recheck Nimiq Pay':'Check Nimiq Pay host'}</button>
      <button class="tertiary full" id="tenant-check-rpc" type="button" ${rpcChecking?'disabled':''}>${rpcChecking?'Checking RPC…':'Check independent mainnet RPC'}</button>
      <button class="tertiary full" id="tenant-check-accounts" type="button" ${walletInventoryBusy||hostStatus!=='connected'||check?.network!=='mainnet'?'disabled':''}>${walletInventoryBusy?'Reading accounts…':'Check payer addresses (native permission)'}</button>
      ${walletSnapshot?`<div class="account-note">${walletSnapshot.accounts.length} address(es) shared. ${escapeHtml(receivingAddressAssessment(walletSnapshot,request.recipient).message)}</div>`:''}
      ${walletInventoryError?`<div class="inline-alert">${escapeHtml(walletInventoryError)}</div>`:''}
      <div class="gate-summary" role="status">${!paymentEnabled?'<strong>Read-only deployment — payment intentionally disabled.</strong>':gate.allowed?'<strong>Safety checks passed; wallet approval is still required.</strong>':`<strong>Wallet test blocked:</strong><ul>${warnings.map(reason=>`<li>${escapeHtml(reason)}</li>`).join('')}</ul>`}</div>
      <div class="consent-row"><label class="consent"><input id="ack-recipient" type="checkbox" ${recipientAcknowledged?'checked':''}/> I confirmed the recipient's address through a trusted channel outside this editable link.</label></div>
      <div class="consent-row"><label class="consent"><input id="ack-real-money" type="checkbox" ${realMoneyAcknowledged?'checked':''}/> I understand this will move REAL NIM if I approve it in Nimiq Pay.</label></div>
      <div class="consent-row"><label class="consent"><input id="ack-payment" type="checkbox" ${paymentAcknowledged?'checked':''}/> I will review amount, recipient, fee and memo again in the native wallet approval dialog. A hash is not a rent receipt.</label></div>
      <button id="send-payment" class="primary full" type="button" ${gate.allowed?'':'disabled'}>${paymentBusy?'Waiting for wallet…':submittedHash?'Submitted — not verified':outcomeUnknown?'Outcome unknown — do not retry':paymentEnabled?'Request Nimiq Pay native approval':'Payments locked — read-only'} ${icon('arrow')}</button>
      <div class="checkout-status" role="status">${hostMessage?escapeHtml(hostMessage):submittedHash?'Wallet returned a transaction hash; check its amount and finality independently. Do NOT retry.':outcomeUnknown?'A wallet request occurred but its outcome remains uncertain. Do NOT retry.':paymentBusy?'Waiting for the native Nimiq Pay wallet response…':'No native wallet transfer initiated from this page.'}</div>
    </div>
    ${submittedHash?`<div class="pending-result"><strong>Submitted, NOT verified as paid</strong><span class="mono">${escapeHtml(submittedHash)}</span><p>Hash is not proof of payment. Paste/recheck the hash in the read-only verification panel below; do not retry if its status is uncertain.</p></div>`:''}
    ${outcomeUnknown?`<div class="pending-result"><strong>Outcome unknown — DO NOT retry yet</strong><p>Inspect Nimiq Pay transaction history and independently verify on-chain before attempting another payment.</p></div>`:''}
  </div>${tenantEvidencePanel(request)}<p class="checkout-foot">RentRail is non-custodial. Payment approval happens inside Nimiq Pay, never in this page.</p></div>`;
}
function observedTransferAmount(request: SharedRequest, result: VerifyResult | null): string {
  if(result?.state!=='FINAL_MATCHED'||typeof result.amountLuna!=='number')return '';
  const partial=result.amountLuna<request.amountLuna;
  const heading=partial?'Partial transfer observed':'Full requested amount observed in this transaction';
  return `<div class="g3-amount-note"><strong>${heading}</strong><p>${formatNim(result.amountLuna)} NIM reported in this transaction, against ${formatNim(request.amountLuna)} NIM requested.</p><small>${partial?'Additional transfers may exist. This is not a verified remaining balance or a rent receipt.':'This does not prove the recipient owns the address or that the rental contract is legally settled.'}</small></div>`;
}
function tenantEvidencePanel(request: SharedRequest): string {
  const result=tenantVerifyResult ? `<div class="g3-result" role="status"><strong>${tenantVerifyResult.state==='FINAL_MATCHED'?'Public node reports matching finality':escapeHtml(tenantVerifyResult.state.replaceAll('_',' '))}</strong><p>${escapeHtml(tenantVerifyResult.message)}</p><small>Checked ${escapeHtml(tenantVerifyResult.observedAt)}</small></div>`:'';
  return `<section class="checkout-card evidence-card">
    <div class="eyebrow">VERIFY A RENT TRANSFER · READ ONLY</div><h2>Know what happened on-chain</h2>
    <p>Already sent NIM? Paste its public transaction hash. Our independent public node checks the recipient, month reference, amount, and finality. No funds are moved here.</p>
    <form id="tenant-proof-form" class="form-stack">
      <label>Public transaction hash<input name="hash" value="${escapeHtml(tenantHash)}" maxlength="64" pattern="[a-fA-F0-9]{64}" type="text" spellcheck="false" autocomplete="off" placeholder="64 hexadecimal characters" required/></label>
      <button class="primary full" ${tenantVerifyBusy?'disabled':''} type="submit">${tenantVerifyBusy?'Checking…':'Verify transaction'} ${icon('arrow')}</button>
    </form>
    ${result}
    ${observedTransferAmount(request,tenantVerifyResult)}
    ${tenantVerifyResult?.state==='FINAL_MATCHED'?'<button id="tenant-copy-audit" class="tertiary full" type="button">Copy shareable recheck link</button>':''}
    <small>Any link can be modified. This is not proof of the landlord's identity, nor legal confirmation that rent is paid. A fresh independent check is required by each viewer.</small>
  </section>`;
}
function independentAuditView(audit:PublicPaymentAudit):string {
  const r=audit.request;
  const status=publicAuditResult ? `<div class="g3-result" role="status"><strong>${publicAuditResult.state==='FINAL_MATCHED'?'Matching finality reported by one public RPC node':escapeHtml(publicAuditResult.state.replaceAll('_',' '))}</strong><p>${escapeHtml(publicAuditResult.message)}</p><small>${escapeHtml(publicAuditResult.observedAt)}</small></div>`:
    '<div class="inline-alert">Not verified on this device. Press Recheck blockchain to request fresh public RPC evidence.</div>';
  return `<div class="checkout evidence-checkout"><div class="checkout-head"><div class="eyebrow">RENT EVIDENCE · INDEPENDENT RECHECK</div><h1>See the transaction. <em>Check the facts.</em></h1><p>Open this link on any device to independently query a public Nimiq node. No account, custody or private rent records required.</p></div>
  <section class="checkout-card">
    <span class="checkout-label">${escapeHtml(r.period)} · Public payment request</span>
    <div class="checkout-value">${formatNim(r.amountLuna)} <span>NIM requested</span></div>
    <div class="hr"></div>
    <div class="detail"><span>Expected recipient</span><strong class="mono">${escapeHtml(r.recipient)}</strong></div>
    <div class="detail"><span>Opaque month reference</span><strong class="mono">${escapeHtml(r.memo)}</strong></div>
    <div class="detail"><span>Transaction to check</span><strong class="mono">${escapeHtml(audit.txHash)}</strong></div>
    <button id="audit-recheck" class="primary full" ${publicAuditBusy?'disabled':''} type="button">${publicAuditBusy?'Checking public RPC…':'Recheck blockchain independently'} ${icon('arrow')}</button>
    ${status}
    ${observedTransferAmount(r,publicAuditResult)}
    <div class="inline-alert">This public link is <strong>not digitally signed</strong> and can be modified. Confirm recipient ownership with the landlord independently. A blockchain match is not proof that a legal rental obligation is discharged.</div>
    <a class="tertiary" href="/">Back to RentRail</a>
  </section></div>`;
}
function render():void {
  const p=activePortfolio();
  const content=publicAudit?independentAuditView(publicAudit):publicAuditError?`<div class="error-page"><h1>Invalid verification link</h1><p>${escapeHtml(publicAuditError)}</p><a href="/">Back to RentRail</a></div>`:tenantRequest?tenantView(tenantRequest):tenantError?`<div class="error-page"><h1>Invalid request</h1><p>${escapeHtml(tenantError)}</p><a href="/">Back to dashboard</a></div>`:({overview:overview(p),properties:propertiesView(p),charges:chargesView(p),wallet:walletView() + g3Panel(p)})[selectedView];
  root!.innerHTML=`<div class="app-shell ${tenantRequest||publicAudit||publicAuditError?'tenant-shell':''}">
    <aside class="sidebar"><a class="brand" href="/"><span class="brand-symbol">R<span>·</span></span><span>rentrail<small>CYCLE III · PAY</small></span></a>
      <span class="nav-label">WORKSPACE</span><nav aria-label="Main navigation">${navButton('overview','Overview','home')}${navButton('properties','Properties','building')}${navButton('charges','Rent ledger','receipt')}${navButton('wallet','Wallet gate','wallet')}</nav>
      <div class="sidebar-bottom"><div class="side-note">${icon('shield')}<span>Non-custodial<br/><small>Evidence-first payments</small></span></div><div class="sidebar-footer">CYCLE III · PAY<br/>2026 BUILD</div></div>
    </aside><div class="main-wrap"><header class="topbar"><div class="mobile-brand">R<span>·</span><small>rentrail</small></div><span class="topbar-caption">${publicAudit?'RENT EVIDENCE':tenantRequest?'RENT PAYMENT':selectedView.toUpperCase()}</span><div class="topbar-right"><span class="label-chip">${preview?'EXAMPLE PREVIEW':'LOCAL WORKSPACE'}</span>${walletIndicator()}</div></header>
      <main class="main-content">${preview?`<div class="demo-banner">${icon('alert')} EXAMPLE PREVIEW ONLY — fictional units, no real payments. <button id="exit-preview">Exit preview</button></div>`:''}${content}${toast?`<div class="toast" role="status">${escapeHtml(toast)}</div>`:''}</main>
      ${!tenantRequest&&!publicAudit&&!publicAuditError?`<nav class="mobile-nav" aria-label="Mobile navigation">${navButton('overview','Home','home')}${navButton('properties','Units','building')}${navButton('charges','Rent','receipt')}${navButton('wallet','Wallet','wallet')}</nav>`:''}
    </div></div>`;
  if(!tenantRequest&&!tenantError&&!publicAudit&&!publicAuditError&&!p.properties.length&&selectedView==='overview'&&!preview) {
    const empty = document.createElement('div');
    empty.className='start-banner';
    empty.innerHTML=`<strong>Explore before you create</strong><p>See a clearly labeled fictional portfolio, or set up your own local workspace.</p><button id="preview-demo" class="secondary" type="button">Preview example workspace ${icon('arrow')}</button>`;
    root!.querySelector('.main-content')?.appendChild(empty);
  }
  bindEvents();
}
function success(message:string):void { toast=message; render(); setTimeout(()=>{ toast='';render(); },4600); }
function error(message:string):void { toast=`Notice: ${message}`;render(); }
function formValue(form:HTMLFormElement,key:string):string { return String(new FormData(form).get(key)||'').trim(); }
function bindEvents():void {
  root!.querySelectorAll<HTMLButtonElement>('[data-nav]').forEach(button=>button.addEventListener('click',()=>{
    selectedView=button.dataset.nav as View; toast=''; render(); window.scrollTo(0,0);
  }));
  root!.querySelector('#preview-demo')?.addEventListener('click',()=>{preview=true; render();});
  root!.querySelector('#exit-preview')?.addEventListener('click',()=>{preview=false; render();});
  root!.querySelector('#workspace-export')?.addEventListener('click',()=>void onWorkspaceExport());
  root!.querySelector<HTMLFormElement>('#workspace-import')?.addEventListener('submit',event=>{
    event.preventDefault();if(preview)return;
    const form=event.target as HTMLFormElement;
    try{importCandidate=readWorkspaceBackup(formValue(form,'backup'));importError='';render();}
    catch(err){importCandidate=null;importError=err instanceof Error?err.message:'Backup rejected';render();}
  });
  root!.querySelector<HTMLInputElement>('#restore-ack')?.addEventListener('change',event=>{
    const btn=root!.querySelector<HTMLButtonElement>('#workspace-apply');
    if(btn)btn.disabled=!(event.target as HTMLInputElement).checked;
  });
  root!.querySelector('#workspace-apply')?.addEventListener('click',()=>{
    if(!importCandidate||preview)return;
    const ack=root!.querySelector<HTMLInputElement>('#restore-ack');
    if(!ack?.checked)return;
    try{
      // Revalidate before write, never merge imported wallet status with our browser.
      const validated=readWorkspaceBackup(JSON.stringify(importCandidate));
      savePortfolio(validated.portfolio);portfolio=validated.portfolio;
      importCandidate=null;importError='';success('Workspace restored locally. Reverify past transfer hashes against mainnet.');
    }catch(err){importError=err instanceof Error?err.message:'Restore failed';render();}
  });
  const propertyForm=root!.querySelector<HTMLFormElement>('#property-form');
  propertyForm?.addEventListener('submit',e=>{e.preventDefault();try{safePersist(addProperty(portfolio,{id:randomId(),name:formValue(propertyForm,'name'),createdAt:new Date().toISOString()}));success('Property added locally.');}catch(err){error(explainHostError(err));}});
  const unitForm=root!.querySelector<HTMLFormElement>('#unit-form');
  unitForm?.addEventListener('submit',e=>{e.preventDefault();try{safePersist(addUnit(portfolio,{id:randomId(),propertyId:formValue(unitForm,'propertyId'),label:formValue(unitForm,'label')}));success('Unit added locally.');}catch(err){error(explainHostError(err));}});
  const chargeForm=root!.querySelector<HTMLFormElement>('#charge-form');
  chargeForm?.addEventListener('submit',e=>{e.preventDefault();try{
    const id=randomId(); const charge:Charge={id,unitId:formValue(chargeForm,'unitId'),period:formValue(chargeForm,'period'),amountLuna:parseNim(formValue(chargeForm,'amount')),recipient:formValue(chargeForm,'recipient'),memo:makeMemo(id),createdAt:new Date().toISOString()};
    safePersist(addCharge(portfolio,charge));success('Obligation created. Share its request link only after recipient verification.');
  }catch(err){error(explainHostError(err));}});
  root!.querySelectorAll<HTMLButtonElement>('[data-share]').forEach(button=>button.addEventListener('click',async()=>{
    const charge=portfolio.charges.find(c=>c.id===button.dataset.share);
    if(!charge||preview)return;
    const url=new URL(window.location.pathname,window.location.origin);
    url.searchParams.set('pay',encodeRequest(shareableRequest(charge)));
    try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(url.toString());success('Payment-request link copied. Verify recipient with the other party.');}else{window.prompt('Copy this payment-request link',url.toString());success('Request link shown for copying.');}}
    catch{window.prompt('Copy this payment-request link',url.toString());}
  }));
  root!.querySelectorAll<HTMLInputElement>('#month-filter, #renewal-month').forEach(input=>input.addEventListener('change',e=>{
    const month=(e.target as HTMLInputElement).value;
    if(!/^\\d{4}-(0[1-9]|1[0-2])$/.test(month))return;
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
      success(`${result.generated} local invoice(s) created for ${result.newPeriod}. No NIM was sent.`);
    }catch(err){nextPeriodPreview=null;error(explainHostError(err));}
  });
  root!.querySelector('#tenant-proof-form')?.addEventListener('submit',e=>{
    e.preventDefault();
    const form=e.target as HTMLFormElement;
    void onTenantEvidence(form);
  });
  root!.querySelector('#audit-recheck')?.addEventListener('click',()=>void onAuditRecheck());
  root!.querySelector('#tenant-copy-audit')?.addEventListener('click',()=>void onCopyAudit('tenant'));
  root!.querySelector('#g3-copy-audit')?.addEventListener('click',()=>void onCopyAudit('owner'));
  root!.querySelector('#g3-save-observation')?.addEventListener('click',()=>{
    if(preview||txVerifyResult?.state!=='FINAL_MATCHED'||txVerifiedChargeId!==txChargeId)return;
    try{
      const book=saveObservedMatch(loadCasebook(portfolio),portfolio,txChargeId,txVerifyResult);
      persistCasebook(book,portfolio);
      success('A node-reported match was saved as historical evidence. Recheck before relying on it.');
    }catch(err){error(err instanceof Error?err.message:'Could not save observation.');}
  });

  root!.querySelector('#g3-network')?.addEventListener('click',()=>void onRpcCheck());
  const g3Form=root!.querySelector<HTMLFormElement>('#g3-verify-form');
  g3Form?.addEventListener('submit',e=>{e.preventDefault();void onVerifyG3(g3Form);});
  g3Form?.addEventListener('input',()=>{txVerifyResult=null;const card=root!.querySelector('#g3-result');if(card)card.textContent='Parameters changed. Verify the new transaction hash before trusting prior results.';});
  root!.querySelector('#wallet-accounts-read')?.addEventListener('click',()=>void onWalletInventoryRead());
  root!.querySelector('#tenant-check-accounts')?.addEventListener('click',()=>void onWalletInventoryRead());
  root!.querySelectorAll<HTMLButtonElement>('[data-wallet-copy]').forEach(btn=>btn.addEventListener('click',()=>void onCopyPublicWalletAddress(btn.dataset.walletCopy||'')));
  root!.querySelector('#check-host')?.addEventListener('click',()=>void onHostCheck());
  root!.querySelector('#tenant-check-host')?.addEventListener('click',()=>void onHostCheck());
  root!.querySelector<HTMLInputElement>('#ack-recipient')?.addEventListener('change',e=>{recipientAcknowledged=(e.target as HTMLInputElement).checked;render();});
  root!.querySelector<HTMLInputElement>('#ack-real-money')?.addEventListener('change',e=>{realMoneyAcknowledged=(e.target as HTMLInputElement).checked;render();});
  root!.querySelector<HTMLInputElement>('#ack-payment')?.addEventListener('change',e=>{paymentAcknowledged=(e.target as HTMLInputElement).checked;render();});
  root!.querySelector('#tenant-check-rpc')?.addEventListener('click',()=>void onRpcCheck());
  root!.querySelector('#send-payment')?.addEventListener('click',()=>void onTenantPay());
}

async function onWorkspaceExport():Promise<void>{
 if(preview)return;
 try{
   const json=createWorkspaceBackup(portfolio);
   if(navigator.clipboard?.writeText){
     await navigator.clipboard.writeText(json);
     success('Backup JSON copied. Keep it private; it contains property labels and public receiving addresses.');
   }else{
     window.prompt('Copy private RentRail workspace JSON',json);
   }
 }catch(err){error(err instanceof Error?err.message:'Unable to export workspace.');}
}
async function copyPublicUrl(url:string):Promise<void>{
  if(navigator.clipboard?.writeText){try{await navigator.clipboard.writeText(url);success('Public verification link copied. Share only with people who need to review the payment.');return;}catch{/* fall back */}}
  window.prompt('Copy public verification link',url);
}
async function onCopyAudit(where:'tenant'|'owner'):Promise<void>{
  try{
    let request:SharedRequest;
    let hash:string;
    if(where==='tenant'){
      if(!tenantRequest||tenantVerifyResult?.state!=='FINAL_MATCHED')return;
      request=tenantRequest;hash=tenantHash;
    }else{
      if(txVerifyResult?.state!=='FINAL_MATCHED')return;
      const charge=portfolio.charges.find(c=>c.id===txChargeId);
      if(!charge||txVerifiedChargeId!==charge.id)return;
      request=shareableRequest(charge);hash=txHashInput;
    }
    const url=auditUrl(window.location.origin,window.location.pathname,createPaymentAudit(request,hash));
    await copyPublicUrl(url);
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
  }catch{tenantVerifyResult=null;error('RPC verification could not complete. No rent credit granted.');}
  finally{tenantVerifyBusy=false;render();}
}
async function onAuditRecheck():Promise<void>{
  if(!publicAudit||publicAuditBusy)return;
  publicAuditBusy=true;publicAuditResult=null;render();
  try{
    publicAuditResult=await verifyNimTransaction({hash:publicAudit.txHash,
      recipient:publicAudit.request.recipient,memo:publicAudit.request.memo,
      amountLuna:publicAudit.request.amountLuna,allowPartial:true});
  }catch{publicAuditResult=null;error('Unable to recheck the public node. No rent credit granted.');}
  finally{publicAuditBusy=false;render();}
}
async function onRpcCheck():Promise<void>{
  if(rpcChecking)return;
  rpcChecking=true;rpcNetwork=null;render();
  try{rpcNetwork=await checkPublicMainnetRpc();}
  catch{rpcNetwork={state:'NOT_VERIFIED',message:'Public RPC request failed; no chain proof.',observedAt:new Date().toISOString(),rpcUrl:'https://rpc.nimiqwatch.com/'};}
  finally{rpcChecking=false;render();}
}
async function onVerifyG3(form:HTMLFormElement):Promise<void>{
  if(txVerifyBusy||preview)return;
  txChargeId=formValue(form,'chargeId');
  txHashInput=formValue(form,'hash');
  txVerifyResult=null;
  const charge=portfolio.charges.find(c=>c.id===txChargeId);
  if(!charge){error('Unknown local obligation.');return;}
  txVerifyBusy=true;render();
  try{
    const result=await verifyNimTransaction({hash:txHashInput,recipient:charge.recipient,memo:charge.memo,amountLuna:charge.amountLuna,allowPartial:true});
    txVerifyResult=result;
    txVerifiedChargeId=charge.id;
  }catch{
    txVerifyResult=null;
    error('Unable to verify. No payment has been credited.');
  }finally{txVerifyBusy=false;render();}
}
async function onCopyPublicWalletAddress(address:string):Promise<void>{
  if(!walletSnapshot?.accounts.some(x=>x.address===address))return;
  try{
    if(navigator.clipboard?.writeText){
      await navigator.clipboard.writeText(address);
      success('Public wallet address copied. Never share private keys or recovery phrases.');
    }else window.prompt('Copy public NQ address only',address);
  }catch{window.prompt('Copy public NQ address only',address);}
}
async function onWalletInventoryRead():Promise<void>{
  if(walletInventoryBusy||hostStatus!=='connected'||check?.network!=='mainnet'||!check?.consensus)return;
  walletInventoryBusy=true;walletInventoryError='';walletSnapshot=null;render();
  try{
    walletSnapshot=await inspectWalletAddresses(check.provider,check.network);
  }catch(e){
    walletInventoryError=e instanceof Error&&e.message.toLowerCase().includes('permission')
      ? 'Wallet account sharing was declined. No address was read.'
      : 'Could not read wallet addresses or balances. Check Nimiq Pay permissions and try again.';
  }finally{walletInventoryBusy=false;render();}
}
async function onHostCheck():Promise<void>{
  hostStatus='checking';hostMessage='';walletSnapshot=null;walletInventoryError='';render();
  try{check=await checkHost();hostStatus='connected';}
  catch(err){check=null;hostStatus='error';hostMessage=explainHostError(err);}
  render();
}
async function onTenantPay():Promise<void>{
  if(!tenantRequest||paymentBusy||submittedHash||outcomeUnknown)return;
  const gate=smokeAssessment(tenantRequest);
  if(!gate.allowed||!check||hostStatus!=='connected'){
    error(gate.reasons[0]||'The native host is not ready. No payment requested.');return;
  }
  // Mark the attempt before asking Nimiq Pay to open its native dialog.
  // Storage failure means no send. A reload on this origin cannot silently retry.
  // This is NOT cross-device idempotency; each native send still needs human approval.
  try {
    const key=pilotAttemptKey(tenantRequest.chargeId);
    if(localStorage.getItem(key))throw Error('A previous pilot wallet request is already recorded. Do not retry.');
    localStorage.setItem(key,JSON.stringify({status:'ATTEMPT_STARTED',at:new Date().toISOString()}));
    localStorage.setItem(localPaymentKey(tenantRequest.chargeId),JSON.stringify({status:'OUTCOME_UNKNOWN'}));
  }catch(err){error(err instanceof Error?err.message:'Browser storage unavailable. No payment requested.');return;}
  paymentBusy=true;render();
  try{
    const hash=await submitUserApprovedPayment(check,tenantRequest,gate);
    submittedHash=hash;
    tenantHash=hash;
    hostMessage='';
    try{localStorage.setItem(localPaymentKey(tenantRequest.chargeId),JSON.stringify({status:'SUBMITTED_UNVERIFIED',hash}));}catch{/* Storage may be blocked; user must retain wallet history. */}
    // Tenant view may belong to a different device; no synced settlement assertion.
    if(portfolio.charges.some(c=>c.id===tenantRequest?.chargeId)) {
      try{const next=recordSubmission(portfolio,{chargeId:tenantRequest.chargeId,hash,state:'SUBMITTED_UNVERIFIED',createdAt:new Date().toISOString()});savePortfolio(next);portfolio=next;}
      catch{/* Same-device duplicate attempt: keep existing unresolved record. */}
    }
  }catch(err){
    const description=explainHostError(err);
    const type=(err && typeof err==='object' && 'type' in err)?String(err.type):'';
    outcomeUnknown=true;
    if(type==='PERMISSION_DENIED')hostMessage='Native wallet approval was rejected; no success is claimed. This one-attempt test is locked. Inspect wallet history before considering any new test.';
    else hostMessage=`${description} Outcome needs review; do not retry.`;
    try{localStorage.setItem(localPaymentKey(tenantRequest.chargeId),JSON.stringify({status:'OUTCOME_UNKNOWN'}));}catch{/* Pilot attempt marker already set before native request. */}
  }finally{paymentBusy=false;render();}
}

root.addEventListener('click',e=>{
  const target=e.target as HTMLElement;
  if(target.closest('a[href="/"]'))return;
});
render();