import { sha256 } from '@noble/hashes/sha2.js';
import { registerLeaseValidator, assertPeriod, asciiJson, isSafeLuna, looksLikeNimiqAddress, makeMemo, normalizeAddress, validSigned, validTitle, type SharedRequest, type Signed } from './domain.ts';
import { compactNimiqAddress } from './address-validation.ts';

/**
 * A monthly lease: one signed link, every month's rent request derived from it.
 * The landlord signs the lease once with their Nimiq Pay wallet. Each month's
 * request ID and STUB1 reference are computed from the lease ID and the month, so the
 * tenant's app and the landlord's ledger agree without any server or new link.
 */
export interface Lease {
  v: 1;
  id: string;            // 32 hex, random
  recipient: string;
  amountLuna: number;    // monthly rent
  start: string;         // YYYY-MM, first month due
  dueDay: number;        // 1..28
  title?: string;
  unitId?: string;       // landlord-side only, never needed by the tenant
  sig?: Signed;
}

export function validateLease(raw: unknown): Lease {
  if (!raw || typeof raw !== 'object') throw Error('Invalid lease.');
  const x = raw as Record<string, unknown>;
  if (x.v !== 1 || typeof x.id !== 'string' || !/^[0-9a-f]{32}$/.test(x.id)) throw Error('Invalid lease identifier.');
  if (typeof x.recipient !== 'string' || !looksLikeNimiqAddress(x.recipient)) throw Error('Invalid lease recipient.');
  if (typeof x.amountLuna !== 'number' || !isSafeLuna(x.amountLuna)) throw Error('Invalid monthly amount.');
  if (typeof x.start !== 'string') throw Error('Invalid start month.');
  assertPeriod(x.start);
  if (!Number.isInteger(x.dueDay) || (x.dueDay as number) < 1 || (x.dueDay as number) > 28) throw Error('Invalid due day.');
  const lease: Lease = { v: 1, id: x.id, recipient: normalizeAddress(x.recipient), amountLuna: x.amountLuna, start: x.start, dueDay: x.dueDay as number };
  if (x.title !== undefined) { if (!validTitle(x.title)) throw Error('Invalid lease title.'); lease.title = x.title; }
  if (x.unitId !== undefined) { if (typeof x.unitId !== 'string' || !/^[0-9a-f]{32}$/.test(x.unitId)) throw Error('Invalid unit.'); lease.unitId = x.unitId; }
  if (x.sig !== undefined) { if (!validSigned(x.sig)) throw Error('Invalid lease signature.'); lease.sig = { publicKey: x.sig.publicKey, signature: x.sig.signature }; }
  return lease;
}

/** The text the landlord signs. Covers everything the tenant relies on. ASCII only. */
export function leaseMessage(l: Lease): string {
  const nim = (l.amountLuna / 100_000).toFixed(5).replace(/0+$/, '').replace(/\.$/, '');
  const title = l.title ? `\nFor: ${asciiJson(l.title)}` : '';
  return `Stub monthly lease${title}\nPay to: ${compactNimiqAddress(l.recipient)}\nMonthly: ${nim} NIM (${l.amountLuna} Luna)\nFrom: ${l.start}\nDue day: ${l.dueDay}\nLease: ${l.id}`;
}

/** Request ID for a lease month: SHA-256(lease id + month), first 16 bytes as hex. */
export function leaseChargeId(leaseId: string, period: string): string {
  assertPeriod(period);
  const digest = sha256(new TextEncoder().encode(`Stub:${leaseId}:${period}`));
  return Array.from(digest.slice(0, 16), b => b.toString(16).padStart(2, '0')).join('');
}

/** Lease-only data the tenant needs inside a monthly request: no landlord-side fields. */
export function publicLease(l: Lease): Lease {
  const { unitId: _unit, ...rest } = l;
  return rest;
}

export function leaseRequest(l: Lease, period: string): SharedRequest {
  if (period < l.start) throw Error('This month is before the lease starts.');
  const chargeId = leaseChargeId(l.id, period);
  const r: SharedRequest = { v: 1, chargeId, memo: makeMemo(chargeId), recipient: l.recipient, amountLuna: l.amountLuna, period };
  if (l.title) r.title = l.title;
  r.lease = publicLease(l);
  return r;
}

/** True when a request really is the given month of its embedded lease. */
export function requestMatchesLease(r: SharedRequest): boolean {
  if (!r.lease) return false;
  try {
    const expected = leaseRequest(r.lease, r.period);
    return expected.chargeId === r.chargeId && expected.memo === r.memo &&
      normalizeAddress(expected.recipient) === normalizeAddress(r.recipient) && expected.amountLuna === r.amountLuna &&
      expected.title === r.title;
  } catch { return false; }
}

export function addMonths(period: string, n: number): string {
  assertPeriod(period);
  const total = Number(period.slice(0, 4)) * 12 + Number(period.slice(5, 7)) - 1 + n;
  return `${Math.floor(total / 12)}-${String(total % 12 + 1).padStart(2, '0')}`;
}

/** Months from the lease start up to `current` (inclusive), newest last, at most `max`. */
export function leaseMonths(l: Lease, current: string, max = 12): string[] {
  assertPeriod(current);
  const out: string[] = [];
  for (let p = current; p >= l.start && out.length < max; p = addMonths(p, -1)) out.unshift(p);
  return out;
}

registerLeaseValidator(validateLease);
