import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addProof, evidenceByCharge, parseProofs, removeProof, type StoredProof } from '../src/proof-store.ts';
import { payableAmountIssue } from '../src/amount-rules.ts';
import { makeMemo, projectCharge, type Charge } from '../src/domain.ts';

const a = '0123456789abcdef0123456789abcdef';
const b = 'fedcba9876543210fedcba9876543210';
const h1 = '1'.repeat(64), h2 = '2'.repeat(64);
const at = '2026-11-11T12:00:00.000Z';
const proof = (chargeId: string, hash: string, amountLuna: number): StoredProof => ({ chargeId, hash, amountLuna, verifiedAt: at });

test('a hash is credited once and never to two different requests', () => {
  let r = addProof([], proof(a, h1, 50_000));
  assert.equal(r.outcome, 'ADDED');
  r = addProof(r.proofs, proof(a, h1, 50_000));
  assert.equal(r.outcome, 'ALREADY_RECORDED');
  assert.equal(r.proofs.length, 1);
  r = addProof(r.proofs, proof(b, h1.toUpperCase(), 50_000));
  assert.equal(r.outcome, 'USED_BY_OTHER_CHARGE');
  assert.equal(r.proofs.length, 1);
});

test('invalid proofs are rejected', () => {
  assert.throws(() => addProof([], proof(a, 'xyz', 1)));
  assert.throws(() => addProof([], proof(a, h1, 0)));
  assert.throws(() => addProof([], proof('nope', h1, 5)));
});

test('untrusted storage is parsed defensively', () => {
  assert.deepEqual(parseProofs(null), []);
  assert.deepEqual(parseProofs('{not json'), []);
  assert.deepEqual(parseProofs('{"a":1}'), []);
  const raw = JSON.stringify([proof(a, h1, 10), proof(b, h1, 10), { chargeId: a, hash: h2, amountLuna: -1, verifiedAt: at }, proof(b, h2, 7)]);
  const parsed = parseProofs(raw);
  assert.equal(parsed.length, 2);
  assert.deepEqual(parsed.map(p => p.hash), [h1, h2]);
  assert.equal(parseProofs(raw, new Set([b])).length, 1);
  assert.deepEqual(removeProof(parsed, h1).map(p => p.hash), [h2]);
});

test('stored proofs reconcile the ledger: partial, then paid', () => {
  const charge: Charge = { id: a, unitId: b, period: '2026-11', amountLuna: 100_000, recipient: 'NQ0700000000000000000000000000000000', memo: makeMemo(a), createdAt: at };
  let proofs = addProof([], proof(a, h1, 40_000)).proofs;
  let projection = projectCharge(charge, evidenceByCharge(proofs, [charge])[a] ?? []);
  assert.equal(projection.status, 'PARTIALLY_FUNDED');
  assert.equal(projection.dueLuna, 60_000);
  proofs = addProof(proofs, proof(a, h2, 60_000)).proofs;
  projection = projectCharge(charge, evidenceByCharge(proofs, [charge])[a] ?? []);
  assert.equal(projection.status, 'PAID_ONCHAIN_VERIFIED');
  assert.equal(projection.dueLuna, 0);
});

test('payable amounts keep two decimals so the wallet sheet is exact', () => {
  assert.equal(payableAmountIssue(500), 'The minimum rent request is 0.01 NIM.');
  assert.equal(payableAmountIssue(1000), null);
  assert.equal(payableAmountIssue(1_250_000), null);
  assert.match(payableAmountIssue(1_250_500) ?? '', /2 decimals/);
});
