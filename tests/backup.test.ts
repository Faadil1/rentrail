import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createBackup, restoreBackup } from '../src/backup.ts';
import { addCharge, addProperty, addUnit, emptyPortfolio, makeMemo } from '../src/domain.ts';

const P = '1'.repeat(32), U = '2'.repeat(32), C = '3'.repeat(32);
const at = '2026-11-11T00:00:00.000Z';
function sample() {
  let p = addProperty(emptyPortfolio(), { id: P, name: 'Cedar', createdAt: at });
  p = addUnit(p, { id: U, propertyId: P, label: 'A-1' });
  return addCharge(p, { id: C, unitId: U, period: '2026-11', amountLuna: 125_000, recipient: 'NQ0700000000000000000000000000000000', memo: makeMemo(C), createdAt: at });
}

test('backup round-trips ledger, proofs and due days', () => {
  const proofs = [{ chargeId: C, hash: 'a'.repeat(64), amountLuna: 125_000, verifiedAt: at }];
  const restored = restoreBackup(createBackup(sample(), proofs, { [U]: 5 }));
  assert.equal(restored.portfolio.charges.length, 1);
  assert.equal(restored.proofs.length, 1);
  assert.deepEqual(restored.dueDays, { [U]: 5 });
});

test('tampered or foreign files are rejected or cleaned', () => {
  assert.throws(() => restoreBackup('nope'), /not a Stub backup/);
  assert.throws(() => restoreBackup('{"app":"other","version":1}'), /not a Stub backup/);
  const raw = JSON.parse(createBackup(sample(), [], {}));
  raw.portfolio.charges[0].memo = 'STUB1:tenant name';
  assert.throws(() => restoreBackup(JSON.stringify(raw)));
  const orphan = JSON.parse(createBackup(sample(), [{ chargeId: '9'.repeat(32), hash: 'b'.repeat(64), amountLuna: 1, verifiedAt: at }], { ['8'.repeat(32)]: 3 }));
  const cleaned = restoreBackup(JSON.stringify(orphan));
  assert.equal(cleaned.proofs.length, 0);
  assert.deepEqual(cleaned.dueDays, {});
});
