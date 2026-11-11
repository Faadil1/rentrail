/** Pure rental domain logic. NO financial authority lives here. */
export const LUNA_PER_NIM = 100_000;
export type Network = 'nimiq-mainnet' | 'nimiq-testnet';
export type EvidenceStatus = 'FINAL_VERIFIED' | 'SUBMITTED_UNVERIFIED' | 'INCLUDED_NOT_FINAL' | 'UNKNOWN';

export interface Property {
  id: string;
  name: string;
  createdAt: string;
}
export interface Unit {
  id: string;
  propertyId: string;
  label: string;
}
export interface Charge {
  id: string;
  unitId: string;
  period: string; // YYYY-MM
  amountLuna: number;
  recipient: string;
  memo: string; // opaque public reference, <=64 UTF-8 bytes
  createdAt: string;
  /** Shown to the tenant, e.g. "Maple Court · Apt 2B". Covered by the landlord's signature. */
  title?: string;
  /** Landlord's Nimiq wallet signature over rentRequestMessage(). */
  sig?: Signed;
}
export interface Signed { publicKey: string; signature: string }
export interface TransferEvidence {
  network: Network;
  hash: string;
  memo: string;
  recipient: string;
  amountLuna: number;
  status: EvidenceStatus;
}
export interface Submission {
  chargeId: string;
  hash: string | null;
  state: 'SUBMITTED_UNVERIFIED' | 'OUTCOME_UNKNOWN';
  createdAt: string;
}
export interface Portfolio {
  schemaVersion: 1;
  properties: Property[];
  units: Unit[];
  charges: Charge[];
  submissions: Submission[];
}
export type ChargeViewStatus = 'OPEN' | 'SUBMITTED_UNVERIFIED' | 'PARTIALLY_FUNDED' | 'PAID_ONCHAIN_VERIFIED' | 'REVIEW_REQUIRED';
export interface Reconciliation {
  status: ChargeViewStatus;
  creditedLuna: number;
  dueLuna: number;
  exceptions: string[];
  verifiedHashes: string[];
}
export interface SharedRequest {
  v: 1;
  memo: string;
  recipient: string;
  amountLuna: number;
  period: string;
  chargeId: string;
  title?: string;
  sig?: Signed;
  /** Present when this month comes from a signed monthly lease (see lease.ts). */
  lease?: import('./lease.ts').Lease;
}
const HEX = (n: number) => new RegExp(`^[0-9a-f]{${n}}$`);
export function validTitle(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0 && v.length <= 80 && !/[\u0000-\u001f\u007f]/.test(v);
}
export function validSigned(v: unknown): v is Signed {
  if (!v || typeof v !== 'object') return false;
  const x = v as Record<string, unknown>;
  return typeof x.publicKey === 'string' && HEX(64).test(x.publicKey) && typeof x.signature === 'string' && HEX(128).test(x.signature);
}
/** JSON with every non-ASCII character escaped, so it survives btoa() and signatures stay byte-exact. */
export function asciiJson(value: unknown): string {
  return JSON.stringify(value).replace(/[\u007f-\uffff]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
}

export function emptyPortfolio(): Portfolio {
  return { schemaVersion: 1, properties: [], units: [], charges: [], submissions: [] };
}
export function parseNim(input: string): number {
  if (!/^(0|[1-9]\d*)(\.\d{1,5})?$/.test(input.trim())) {
    throw new Error('Enter a positive NIM amount with up to five decimal places.');
  }
  const [whole, fraction = ''] = input.trim().split('.');
  const luna = BigInt(whole) * 100_000n + BigInt(fraction.padEnd(5, '0') || '0');
  if (luna <= 0n || luna > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('Amount must be positive and within safe integer range.');
  }
  return Number(luna);
}
export function formatNim(luna: number): string {
  if (!Number.isSafeInteger(luna) || luna < 0) throw new Error('Invalid Luna value.');
  const whole = Math.floor(luna / LUNA_PER_NIM);
  const fraction = String(luna % LUNA_PER_NIM).padStart(5, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : String(whole);
}
export function isSafeLuna(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}
export function normalizeAddress(address: string): string {
  return address.replace(/\s+/g, '').toUpperCase();
}
/** Structural check only; the wallet performs canonical/checksum validation. */
export function looksLikeNimiqAddress(address: string): boolean {
  return /^NQ[0-9]{2}[0-9A-HJ-NP-VX-Y]{32}$/.test(normalizeAddress(address));
}
export function assertPeriod(value: string): void {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) throw new Error('Period must be YYYY-MM.');
}
export function createId(randomBytes: Uint8Array): string {
  if (randomBytes.length < 16) throw new Error('At least 16 cryptographically random bytes required.');
  return Array.from(randomBytes.slice(0, 16), b => b.toString(16).padStart(2, '0')).join('');
}
export function makeMemo(id: string): string {
  if (!/^[0-9a-f]{32}$/.test(id)) throw new Error('Invalid opaque request ID.');
  const memo = `RR1:${id}`;
  if (new TextEncoder().encode(memo).length > 64) throw new Error('Public memo exceeds 64 bytes.');
  return memo;
}
export function addProperty(p: Portfolio, property: Property): Portfolio {
  if (!property.name.trim() || p.properties.some(x => x.id === property.id)) throw new Error('Invalid or duplicate property.');
  return { ...p, properties: [...p.properties, property] };
}
export function addUnit(p: Portfolio, unit: Unit): Portfolio {
  if (!p.properties.some(x => x.id === unit.propertyId)) throw new Error('Unknown property.');
  if (!unit.label.trim() || p.units.some(x => x.id === unit.id)) throw new Error('Invalid or duplicate unit.');
  return { ...p, units: [...p.units, unit] };
}
export function addCharge(p: Portfolio, charge: Charge): Portfolio {
  assertPeriod(charge.period);
  if (!p.units.some(x => x.id === charge.unitId)) throw new Error('Unknown unit.');
  if (!isSafeLuna(charge.amountLuna)) throw new Error('Invalid amount.');
  if (!looksLikeNimiqAddress(charge.recipient)) throw new Error('Invalid Nimiq address structure.');
  if (!/^RR1:[0-9a-f]{32}$/.test(charge.memo)) throw new Error('Memo must be an opaque request reference.');
  if (p.charges.some(x => x.id === charge.id || x.memo === charge.memo)) throw new Error('Duplicate charge or public reference.');
  if (p.charges.some(x => x.unitId === charge.unitId && x.period === charge.period)) {
    throw new Error('An obligation for this unit and period already exists.');
  }
  if (charge.title !== undefined && !validTitle(charge.title)) throw new Error('Invalid request title.');
  if (charge.sig !== undefined && !validSigned(charge.sig)) throw new Error('Invalid signature.');
  return { ...p, charges: [...p.charges, { ...charge, recipient: normalizeAddress(charge.recipient) }] };
}
export function recordSubmission(p: Portfolio, submission: Submission): Portfolio {
  if (!p.charges.some(c => c.id === submission.chargeId)) throw new Error('Unknown charge.');
  if (p.submissions.some(s => s.chargeId === submission.chargeId)) throw new Error('Unresolved submission already exists; do not retry blindly.');
  return { ...p, submissions: [...p.submissions, submission] };
}
export function projectCharge(charge: Charge, evidence: TransferEvidence[], submissions: Submission[] = []): Reconciliation {
  const exceptions: string[] = [];
  const seen = new Set<string>();
  const verifiedHashes: string[] = [];
  let creditedLuna = 0;
  for (const event of evidence) {
    const hash = event.hash.toLowerCase();
    if (seen.has(hash)) { exceptions.push(`Duplicate transaction hash: ${event.hash}`); continue; }
    seen.add(hash);
    if (event.network !== 'nimiq-mainnet') { exceptions.push('Wrong or unverified network.'); continue; }
    if (event.status !== 'FINAL_VERIFIED') { exceptions.push('Transaction is not independently final and verified.'); continue; }
    if (!isSafeLuna(event.amountLuna)) { exceptions.push('Invalid transfer amount.'); continue; }
    if (event.memo !== charge.memo) { exceptions.push('Wrong rent reference.'); continue; }
    if (normalizeAddress(event.recipient) !== normalizeAddress(charge.recipient)) { exceptions.push('Wrong recipient.'); continue; }
    if (!/^[0-9a-f]{64}$/i.test(event.hash)) { exceptions.push('Malformed transaction hash.'); continue; }
    if (!Number.isSafeInteger(creditedLuna + event.amountLuna)) { exceptions.push('Amount overflow.'); continue; }
    creditedLuna += event.amountLuna;
    verifiedHashes.push(hash);
  }
  let status: ChargeViewStatus = 'OPEN';
  if (exceptions.length || creditedLuna > charge.amountLuna) {
    if (creditedLuna > charge.amountLuna) exceptions.push('Overpayment: manual review required.');
    status = 'REVIEW_REQUIRED';
  } else if (creditedLuna === charge.amountLuna) status = 'PAID_ONCHAIN_VERIFIED';
  else if (creditedLuna > 0) status = 'PARTIALLY_FUNDED';
  else if (submissions.some(s => s.chargeId === charge.id)) status = 'SUBMITTED_UNVERIFIED';
  return { status, creditedLuna, dueLuna: Math.max(0, charge.amountLuna - creditedLuna), exceptions, verifiedHashes };
}
export function shareableRequest(charge: Charge): SharedRequest {
  const r: SharedRequest = { v: 1, chargeId: charge.id, recipient: charge.recipient, amountLuna: charge.amountLuna, memo: charge.memo, period: charge.period };
  if (charge.title) r.title = charge.title;
  if (charge.sig) r.sig = charge.sig;
  return r;
}
export function validateSharedRequest(raw: unknown): SharedRequest {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid payment request.');
  const x = raw as Record<string, unknown>;
  if (x.v !== 1 || typeof x.chargeId !== 'string' || !/^[0-9a-f]{32}$/.test(x.chargeId)) throw new Error('Invalid request identifier.');
  if (typeof x.memo !== 'string' || x.memo !== makeMemo(x.chargeId)) throw new Error('Invalid opaque reference.');
  if (typeof x.recipient !== 'string' || !looksLikeNimiqAddress(x.recipient)) throw new Error('Invalid recipient.');
  if (typeof x.amountLuna !== 'number' || !isSafeLuna(x.amountLuna)) throw new Error('Invalid amount.');
  if (typeof x.period !== 'string') throw new Error('Invalid period.');
  assertPeriod(x.period);
  const out: SharedRequest = { v: 1, chargeId: x.chargeId, memo: x.memo, recipient: normalizeAddress(x.recipient), amountLuna: x.amountLuna, period: x.period };
  if (x.title !== undefined) { if (!validTitle(x.title)) throw new Error('Invalid request title.'); out.title = x.title; }
  if (x.sig !== undefined) { if (!validSigned(x.sig)) throw new Error('Invalid signature format.'); out.sig = { publicKey: x.sig.publicKey, signature: x.sig.signature }; }
  if (x.lease !== undefined) out.lease = leaseValidator(x.lease);
  return out;
}
/** Attaches (or replaces) the landlord signature on an existing request. */
export function setChargeSignature(p: Portfolio, chargeId: string, sig: Signed): Portfolio {
  if (!validSigned(sig)) throw new Error('Invalid signature.');
  if (!p.charges.some(c => c.id === chargeId)) throw new Error('Unknown charge.');
  return { ...p, charges: p.charges.map(c => c.id === chargeId ? { ...c, sig } : c) };
}

// Set by lease.ts to avoid a circular import at module load.
let leaseValidator: (raw: unknown) => import('./lease.ts').Lease = () => { throw new Error('Leases are not supported here.'); };
export function registerLeaseValidator(fn: typeof leaseValidator): void { leaseValidator = fn; }
