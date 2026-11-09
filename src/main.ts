import './styles.css';
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
let check: HostCheck | null = null;
let hostStatus: 'unchecked' | 'checking' | 'connected' | 'error' = 'unchecked';
let hostMessage = '';
let toast = '';
let tenantRequest: SharedRequest | null = null;
let tenantError = '';
let paymentBusy = false;
let paymentAcknowledged = false;
let submittedHash: string | null = null;
let outcomeUnknown = false;
// Prevent an accidental duplicate request after reloading a tenant's browser.
// Browser storage is best effort, not a network-wide duplicate-payment lock.
function localPaymentKey(id:string):string{return `rentrail-pending-${id}`;}

const search = new URLSearchParams(window.location.search);
if (search.has('pay')) {
  try {
    tenantRequest = decodeRequest(search.get('pay') || '');
    const prior = localStorage.getItem(localPaymentKey(tenantRequest.chargeId));
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
    <section class="section"><div class="section-heading"><div><div class="eyebrow">YOUR WORKSPACE</div><h2>Recent obligations</h2></div><button class="tertiary" data-nav="charges">View all ${icon('arrow')}</button></div>
      ${chargeCards || emptyState('No rent charges yet','Create a property and unit, then issue your first monthly rent request.','properties','Create a property')}
    </section>
    <div class="safety"><span>${icon('shield')}</span><div><strong>Designed to show what is proven.</strong><p>Sending a transaction never marks an obligation as paid. Independent mainnet reconciliation is a separate required gate.</p></div></div>`;
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
function chargesView(p:Portfolio):string {
  return `<div class="page-title"><div><div class="eyebrow">RENT LEDGER</div><h1>Monthly <em>obligations.</em></h1><p>Requests and partial-payment accounting, without false confirmations.</p></div></div>
  <div class="two-col"><section class="panel"><h3>New rent obligation</h3><form id="charge-form" class="form-stack">
    <label>Unit<select name="unitId" required>${p.units.map(u=>`<option value="${escapeHtml(u.id)}">${normalizeLabel(p.properties.find(b=>b.id===u.propertyId)?.name||'')} / ${normalizeLabel(u.label)}</option>`).join('')}</select></label>
    <div class="form-duo"><label>Period<input name="period" type="month" value="${currentPeriod()}" required /></label><label>Amount in NIM<input name="amount" inputmode="decimal" placeholder="1.25" required /></label></div>
    <label>Landlord's Nimiq receiving address<textarea name="recipient" rows="2" placeholder="NQ..." spellcheck="false" required></textarea></label>
    <p class="form-hint">The memo will be an opaque ID, never a tenant name or address. Amounts here are NIM obligations, not automatic fiat conversions.</p>
    <button class="primary" type="submit" ${preview||!p.units.length?'disabled':''}>${icon('plus')} Create obligation</button>
  </form></section><section class="stack"><div class="section-heading"><h2>Rent requests</h2><span class="count">${p.charges.length}</span></div>${p.charges.length?p.charges.slice().reverse().map(c=>chargeRow(p,c)).join(''):emptyState('No obligations recorded','Create a property and a unit before issuing a request.','properties','Set up property')}</section></div>
  <div class="safety"><span>${icon('shield')}</span><div><strong>Sending is not settlement.</strong><p>All requests start OPEN. Any wallet-submitted hash remains unverified until independent chain verification is implemented.</p></div></div>`;
}
function walletView():string {
  return `<div class="page-title"><div><div class="eyebrow">NIMIQ PAY · HOST GATE</div><h1>Wallet <em>connection.</em></h1><p>Check the actual Mini App provider, not a standalone Safari browser tab.</p></div></div>
  <div class="wallet-panel"><div class="wallet-large">${icon('wallet')}</div><h2>${hostStatus==='connected'?'SDK provider detected':'Connect Nimiq Pay'}</h2><p class="wallet-copy">${hostStatus==='connected' ? (check?.consensus?'Nimiq Pay SDK responded and reported consensus. The chain network is NOT independently attested.':'Provider found but consensus is not established.') : 'Open this app from Nimiq Pay → Mini Apps to authorize SDK access. Browsers alone do not inject the wallet provider.'}</p>
  <button id="check-host" class="primary" type="button" ${hostStatus==='checking'?'disabled':''}>${hostStatus==='checking'?'Checking…':'Check host'} ${icon('arrow')}</button>
  ${hostStatus==='error'?`<div class="inline-alert">${icon('alert')} ${escapeHtml(hostMessage)}</div>`:''}
  ${hostStatus==='connected'?`<div class="host-report"><div><span>Host provider</span><b>Detected</b></div><div><span>Consensus</span><b>${check?.consensus?'Established':'Unavailable'}</b></div><div><span>Block height</span><b>${check?.blockHeight??'Unknown'}</b></div><div><span>Balance method</span><b>${check?.balanceReadAvailable?'Available':'Missing / old host'}</b></div><div><span>Mainnet attested</span><b>No — separate RPC gate</b></div></div>`:''}
  </div>
  <div class="safety"><span>${icon('shield')}</span><div><strong>No automatic transfers or custody.</strong><p>Only an explicit tenant payment click can request a native Nimiq Pay approval. We never read private keys or equate a returned hash with final settlement.</p></div></div>`;
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
function tenantView(request:SharedRequest):string {
  return `<div class="checkout"><div class="checkout-head"><div class="eyebrow">TENANT PAYMENT REQUEST</div><h1>Rent, with <em>clarity.</em></h1><p>Review these instructions against your trusted landlord contact before moving any NIM.</p></div>
  <div class="checkout-card"><span class="checkout-label">${escapeHtml(request.period)} rent obligation</span><div class="checkout-value">${formatNim(request.amountLuna)} <span>NIM</span></div><div class="hr"></div>
    <div class="detail"><span>Recipient</span><strong class="mono">${escapeHtml(request.recipient)}</strong></div>
    <div class="detail"><span>Public memo</span><strong class="mono">${escapeHtml(request.memo)}</strong></div>
    <div class="detail"><span>Reference</span><strong class="mono">${escapeHtml(request.chargeId.slice(0,10))}…</strong></div>
    <div class="inline-alert">${icon('alert')} Link contents can be altered by anyone sharing it. Verify the recipient with your landlord independently. This request does not prove identity or a legal debt.</div>
    <div class="consent-row"><label class="consent"><input id="ack-payment" type="checkbox" ${paymentAcknowledged?'checked':''}/> I independently verified the recipient and understand Nimiq Pay may be set to testnet or mainnet. A submitted transfer is not a verified rent receipt.</label></div>
    <button id="send-payment" class="primary full" type="button" ${!paymentAcknowledged||paymentBusy||outcomeUnknown||submittedHash?'disabled':''}>${paymentBusy?'Waiting for wallet…':submittedHash?'Submitted — not verified':outcomeUnknown?'Outcome unknown — check wallet':'Request NIM payment approval'} ${icon('arrow')}</button>
    <button class="tertiary full" id="tenant-check-host" type="button" ${hostStatus==='checking'?'disabled':''}>${hostStatus==='connected'?'Recheck Nimiq Pay':'Check Nimiq Pay host'}</button>
    <div class="checkout-status">${hostMessage ? escapeHtml(hostMessage) : hostStatus==='connected' ? `Wallet bridge: detected · Consensus ${check?.consensus?'established':'not ready'}` : hostStatus==='error'?escapeHtml(hostMessage):'Wallet bridge not yet verified on this device.'}</div>
    ${submittedHash?`<div class="pending-result"><strong>Submitted, NOT verified as paid</strong><span class="mono">${escapeHtml(submittedHash)}</span><p>Check your wallet history. No independent finality/reconciliation has been performed in this build.</p></div>`:''}
    ${outcomeUnknown?`<div class="pending-result"><strong>Outcome unknown — DO NOT retry yet</strong><p>Inspect Nimiq Pay transaction history and independently verify on-chain before attempting another payment.</p></div>`:''}
  </div><p class="checkout-foot">RentRail is non-custodial. Payment approval happens inside Nimiq Pay, never in this page.</p></div>`;
}
function render():void {
  const p=activePortfolio();
  const content=tenantRequest?tenantView(tenantRequest):tenantError?`<div class="error-page"><h1>Invalid request</h1><p>${escapeHtml(tenantError)}</p><a href="/">Back to dashboard</a></div>`:({overview:overview(p),properties:propertiesView(p),charges:chargesView(p),wallet:walletView()})[selectedView];
  root!.innerHTML=`<div class="app-shell ${tenantRequest?'tenant-shell':''}">
    <aside class="sidebar"><a class="brand" href="/"><span class="brand-symbol">R<span>·</span></span><span>rentrail<small>WORKING NAME</small></span></a>
      <span class="nav-label">WORKSPACE</span><nav aria-label="Main navigation">${navButton('overview','Overview','home')}${navButton('properties','Properties','building')}${navButton('charges','Rent ledger','receipt')}${navButton('wallet','Wallet gate','wallet')}</nav>
      <div class="sidebar-bottom"><div class="side-note">${icon('shield')}<span>Non-custodial<br/><small>Evidence-first payments</small></span></div><div class="sidebar-footer">CYCLE III · PAY<br/>2026 BUILD</div></div>
    </aside><div class="main-wrap"><header class="topbar"><div class="mobile-brand">R<span>·</span><small>rentrail</small></div><span class="topbar-caption">${tenantRequest?'RENT PAYMENT':selectedView.toUpperCase()}</span><div class="topbar-right"><span class="label-chip">${preview?'EXAMPLE PREVIEW':'LOCAL WORKSPACE'}</span>${walletIndicator()}</div></header>
      <main class="main-content">${preview?`<div class="demo-banner">${icon('alert')} EXAMPLE PREVIEW ONLY — fictional units, no real payments. <button id="exit-preview">Exit preview</button></div>`:''}${content}${toast?`<div class="toast" role="status">${escapeHtml(toast)}</div>`:''}</main>
      ${!tenantRequest?`<nav class="mobile-nav" aria-label="Mobile navigation">${navButton('overview','Home','home')}${navButton('properties','Units','building')}${navButton('charges','Rent','receipt')}${navButton('wallet','Wallet','wallet')}</nav>`:''}
    </div></div>`;
  if(!tenantRequest&&!tenantError&&!p.properties.length&&selectedView==='overview'&&!preview) {
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
  root!.querySelector('#check-host')?.addEventListener('click',()=>void onHostCheck());
  root!.querySelector('#tenant-check-host')?.addEventListener('click',()=>void onHostCheck());
  root!.querySelector<HTMLInputElement>('#ack-payment')?.addEventListener('change',e=>{paymentAcknowledged=(e.target as HTMLInputElement).checked;render();});
  root!.querySelector('#send-payment')?.addEventListener('click',()=>void onTenantPay());
}
async function onHostCheck():Promise<void>{
  hostStatus='checking';hostMessage='';render();
  try{check=await checkHost();hostStatus='connected';}
  catch(err){check=null;hostStatus='error';hostMessage=explainHostError(err);}
  render();
}
async function onTenantPay():Promise<void>{
  if(!tenantRequest||!paymentAcknowledged||paymentBusy||submittedHash||outcomeUnknown)return;
  if(!check||hostStatus!=='connected'||!check.consensus){error('Check Nimiq Pay host and established consensus before requesting wallet approval.');return;}
  paymentBusy=true;render();
  try{
    const hash=await submitUserApprovedPayment(check.provider,tenantRequest);
    submittedHash=hash;
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
    if(type==='PERMISSION_DENIED'){hostMessage='Wallet approval was canceled; no success is claimed.';}
    else {outcomeUnknown=true;hostMessage=`${description} No automatic retry.`; try{localStorage.setItem(localPaymentKey(tenantRequest.chargeId),JSON.stringify({status:'OUTCOME_UNKNOWN'}));}catch{/* Best effort only. */}}
  }finally{paymentBusy=false;render();}
}

root.addEventListener('click',e=>{
  const target=e.target as HTMLElement;
  if(target.closest('a[href="/"]'))return;
});
render();