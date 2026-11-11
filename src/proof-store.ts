import type { TransferEvidence } from './domain.ts';

/**
 * Persisted on-chain payment proofs for this device's ledger.
 * Each proof was matched by the public mainnet history node (recipient, amount,
 * RR1 reference, execution, finality) before being stored. A hash can only
 * ever count once, across all charges.
 */
export interface StoredProof {
  chargeId: string;
  hash: string;
  amountLuna: number;
  verifiedAt: string;
}
export const PROOF_STORAGE_KEY = 'rentrail-verified-payments-v1';
export const MAX_PROOFS = 2000;

const HASH = /^[0-9a-f]{64}$/;
const ID = /^[0-9a-f]{32}$/;

function validProof(x: unknown): x is StoredProof {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return false;
  const p = x as Record<string, unknown>;
  return typeof p.chargeId === 'string' && ID.test(p.chargeId) &&
    typeof p.hash === 'string' && HASH.test(p.hash) &&
    typeof p.amountLuna === 'number' && Number.isSafeInteger(p.amountLuna) && p.amountLuna > 0 &&
    typeof p.verifiedAt === 'string' && Number.isFinite(Date.parse(p.verifiedAt));
}

/** Parses untrusted storage. Invalid rows and duplicate hashes are dropped. */
export function parseProofs(raw: string | null, knownChargeIds?: ReadonlySet<string>): StoredProof[] {
  if (!raw) return [];
  let data: unknown;
  try { data = JSON.parse(raw); } catch { return []; }
  if (!Array.isArray(data)) return [];
  const seen = new Set<string>();
  const out: StoredProof[] = [];
  for (const row of data.slice(0, MAX_PROOFS)) {
    if (!validProof(row) || seen.has(row.hash)) continue;
    seen.add(row.hash);
    if (knownChargeIds && !knownChargeIds.has(row.chargeId)) continue;
    out.push({ chargeId: row.chargeId, hash: row.hash, amountLuna: row.amountLuna, verifiedAt: row.verifiedAt });
  }
  return out;
}

export type AddProofOutcome = 'ADDED' | 'ALREADY_RECORDED' | 'USED_BY_OTHER_CHARGE';
/** Adds a proof. A transaction hash can never be credited to two different rent requests. */
export function addProof(proofs: readonly StoredProof[], proof: StoredProof): { proofs: StoredProof[]; outcome: AddProofOutcome } {
  const hash = proof.hash.toLowerCase();
  const candidate = { ...proof, hash };
  if (!validProof(candidate)) throw Error('Invalid payment proof.');
  const existing = proofs.find(p => p.hash === hash);
  if (existing) return { proofs: [...proofs], outcome: existing.chargeId === proof.chargeId ? 'ALREADY_RECORDED' : 'USED_BY_OTHER_CHARGE' };
  if (proofs.length >= MAX_PROOFS) throw Error('Too many stored payment proofs on this device.');
  return { proofs: [...proofs, candidate], outcome: 'ADDED' };
}

export function removeProof(proofs: readonly StoredProof[], hash: string): StoredProof[] {
  return proofs.filter(p => p.hash !== hash.toLowerCase());
}

/** Converts stored proofs into domain evidence keyed by charge, for projectCharge(). */
export function evidenceByCharge(
  proofs: readonly StoredProof[],
  charges: ReadonlyArray<{ id: string; recipient: string; memo: string }>,
): Record<string, TransferEvidence[]> {
  const byId = new Map(charges.map(c => [c.id, c]));
  const out: Record<string, TransferEvidence[]> = {};
  for (const p of proofs) {
    const charge = byId.get(p.chargeId);
    if (!charge) continue;
    (out[p.chargeId] ??= []).push({
      network: 'nimiq-mainnet', hash: p.hash, recipient: charge.recipient, memo: charge.memo,
      amountLuna: p.amountLuna, status: 'FINAL_VERIFIED',
    });
  }
  return out;
}
