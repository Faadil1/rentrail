import { addCharge, addProperty, addUnit, emptyPortfolio, type Portfolio } from './domain.ts';
import { parseProofs, type StoredProof } from './proof-store.ts';

export interface Backup { app: 'rentrail'; version: 1; exportedAt: string; portfolio: Portfolio; proofs: StoredProof[]; dueDays: Record<string, number> }

export function createBackup(portfolio: Portfolio, proofs: StoredProof[], dueDays: Record<string, number>, now = new Date()): string {
  const backup: Backup = { app: 'rentrail', version: 1, exportedAt: now.toISOString(), portfolio, proofs, dueDays };
  return JSON.stringify(backup, null, 2);
}

/**
 * Restores a backup file. Everything is rebuilt through the same validators used when
 * records are created, so a corrupted or edited file cannot inject invalid state.
 */
export function restoreBackup(text: string): { portfolio: Portfolio; proofs: StoredProof[]; dueDays: Record<string, number> } {
  if (text.length > 5_000_000) throw Error('Backup file is too large.');
  let data: unknown;
  try { data = JSON.parse(text); } catch { throw Error('This is not a RentRail backup file.'); }
  const b = data as Partial<Backup> | null;
  if (!b || typeof b !== 'object' || b.app !== 'rentrail' || b.version !== 1 || !b.portfolio || typeof b.portfolio !== 'object')
    throw Error('This is not a RentRail backup file.');
  const src = b.portfolio as Partial<Portfolio>;
  if (!Array.isArray(src.properties) || !Array.isArray(src.units) || !Array.isArray(src.charges)) throw Error('The backup is incomplete.');
  let p = emptyPortfolio();
  const text60 = (v: unknown, max: number) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
  const id = (v: unknown) => typeof v === 'string' && /^[0-9a-f]{32}$/.test(v);
  for (const x of src.properties) {
    if (!x || !id(x.id) || !text60(x.name, 70) || typeof x.createdAt !== 'string') throw Error('Invalid property in backup.');
    p = addProperty(p, { id: x.id, name: x.name, createdAt: x.createdAt });
  }
  for (const x of src.units) {
    if (!x || !id(x.id) || !id(x.propertyId) || !text60(x.label, 60)) throw Error('Invalid unit in backup.');
    p = addUnit(p, { id: x.id, propertyId: x.propertyId, label: x.label });
  }
  for (const x of src.charges) {
    if (!x || !id(x.id) || typeof x.createdAt !== 'string') throw Error('Invalid rent request in backup.');
    p = addCharge(p, { id: x.id, unitId: x.unitId, period: x.period, amountLuna: x.amountLuna, recipient: x.recipient, memo: x.memo, createdAt: x.createdAt });
  }
  const proofs = parseProofs(JSON.stringify(Array.isArray(b.proofs) ? b.proofs : []), new Set(p.charges.map(c => c.id)));
  const dueDays: Record<string, number> = {};
  if (b.dueDays && typeof b.dueDays === 'object' && !Array.isArray(b.dueDays)) {
    for (const [unitId, day] of Object.entries(b.dueDays)) {
      if (p.units.some(u => u.id === unitId) && Number.isInteger(day) && day >= 1 && day <= 28) dueDays[unitId] = day;
    }
  }
  return { portfolio: p, proofs, dueDays };
}
