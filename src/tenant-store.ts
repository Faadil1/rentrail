import { validateSharedRequest, type SharedRequest, type Signed, validSigned } from './domain.ts';
import { compactNimiqAddress, isValidNimiqAddress } from './address-validation.ts';

/**
 * What a tenant's device remembers so the next month is easy and safe:
 * their wallet, the landlord addresses they already paid, and each request with its payment.
 */
export interface TenantPayment { state: 'sent' | 'confirmed' | 'unknown'; hash: string | null; at: string; claim?: Signed }
export interface TenantEntry { request: SharedRequest; savedAt: string; payment?: TenantPayment }
export interface TenantMemory { wallet?: string; paidTo: string[]; entries: TenantEntry[] }
export const TENANT_KEY = 'rentrail-tenant-v1';
const MAX = 240;

export function emptyTenantMemory(): TenantMemory { return { paidTo: [], entries: [] }; }

export function parseTenantMemory(raw: string | null): TenantMemory {
  if (!raw) return emptyTenantMemory();
  try {
    const d = JSON.parse(raw) as Partial<TenantMemory>;
    const out = emptyTenantMemory();
    if (typeof d.wallet === 'string' && isValidNimiqAddress(d.wallet)) out.wallet = compactNimiqAddress(d.wallet);
    if (Array.isArray(d.paidTo)) out.paidTo = [...new Set(d.paidTo.filter(a => typeof a === 'string' && isValidNimiqAddress(a)).map(compactNimiqAddress))].slice(0, 50);
    if (Array.isArray(d.entries)) for (const e of d.entries.slice(0, MAX)) {
      try {
        const request = validateSharedRequest(e?.request);
        if (out.entries.some(x => x.request.chargeId === request.chargeId)) continue;
        const entry: TenantEntry = { request, savedAt: typeof e.savedAt === 'string' ? e.savedAt : new Date(0).toISOString() };
        const p = e.payment;
        if (p && (p.state === 'sent' || p.state === 'confirmed' || p.state === 'unknown') && (p.hash === null || (typeof p.hash === 'string' && /^[0-9a-f]{64}$/.test(p.hash)))) {
          entry.payment = { state: p.state, hash: p.hash, at: typeof p.at === 'string' ? p.at : entry.savedAt };
          if (validSigned(p.claim)) entry.payment.claim = p.claim;
        }
        out.entries.push(entry);
      } catch { /* skip invalid entry */ }
    }
    return out;
  } catch { return emptyTenantMemory(); }
}

export function upsertRequest(m: TenantMemory, request: SharedRequest, now: string): TenantMemory {
  if (m.entries.some(e => e.request.chargeId === request.chargeId)) return m;
  return { ...m, entries: [{ request, savedAt: now }, ...m.entries].slice(0, MAX) };
}
export function setPayment(m: TenantMemory, chargeId: string, payment: TenantPayment | undefined): TenantMemory {
  let entries = m.entries.map(e => e.request.chargeId === chargeId ? { ...e, payment } : e);
  let paidTo = m.paidTo;
  const entry = entries.find(e => e.request.chargeId === chargeId);
  if (entry && payment?.state === 'confirmed') paidTo = [...new Set([...paidTo, compactNimiqAddress(entry.request.recipient)])];
  if (!payment) entries = entries.map(e => e.request.chargeId === chargeId ? { request: e.request, savedAt: e.savedAt } : e);
  return { ...m, entries, paidTo };
}
export function entryFor(m: TenantMemory, chargeId: string): TenantEntry | undefined {
  return m.entries.find(e => e.request.chargeId === chargeId);
}

export type RecipientHistory = 'FIRST_TIME' | 'KNOWN' | 'CHANGED';
/** Compares a request's receiving address with the landlords this tenant already paid. */
export function recipientHistory(m: TenantMemory, recipient: string): RecipientHistory {
  if (!m.paidTo.length) return 'FIRST_TIME';
  return m.paidTo.includes(compactNimiqAddress(recipient)) ? 'KNOWN' : 'CHANGED';
}
