import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addMonths, leaseChargeId, leaseMessage, leaseMonths, leaseRequest, requestMatchesLease, validateLease, type Lease } from '../src/lease.ts';
import { validateSharedRequest } from '../src/domain.ts';

const lease: Lease = { v: 1, id: 'c'.repeat(32), recipient: 'NQ0700000000000000000000000000000000', amountLuna: 125_000_000, start: '2026-10', dueDay: 1, title: 'Maple · 2B' };

test('each month of a lease has a stable, distinct request and reference', () => {
  const nov = leaseRequest(lease, '2026-11'), dec = leaseRequest(lease, '2026-12');
  assert.equal(nov.chargeId, leaseChargeId(lease.id, '2026-11'));
  assert.notEqual(nov.memo, dec.memo);
  assert.equal(leaseRequest(lease, '2026-11').memo, nov.memo);
  assert.throws(() => leaseRequest(lease, '2026-09'));
});

test('a monthly request survives the link round trip and must match its lease', () => {
  const r = validateSharedRequest(JSON.parse(JSON.stringify(leaseRequest(lease, '2026-11'))));
  assert.ok(requestMatchesLease(r));
  assert.equal(requestMatchesLease({ ...r, amountLuna: 1 }), false);
  assert.equal(requestMatchesLease({ ...r, title: 'Changed signed description' }), false);
  assert.equal(requestMatchesLease({ ...r, lease: { ...r.lease!, amountLuna: 1 } }), false);
});

test('lease months, month arithmetic and the signed text', () => {
  assert.deepEqual(leaseMonths(lease, '2027-01'), ['2026-10', '2026-11', '2026-12', '2027-01']);
  assert.equal(addMonths('2026-12', 1), '2027-01');
  assert.equal(addMonths('2027-01', -1), '2026-12');
  assert.match(leaseMessage(lease), /Monthly: 1250 NIM \(125000000 Luna\)\nFrom: 2026-10\nDue day: 1\nLease: c{32}/);
  assert.throws(() => validateLease({ ...lease, dueDay: 31 }));
});
