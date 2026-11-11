import assert from 'node:assert/strict';
import { test } from 'node:test';
import { emptyTenantMemory, parseTenantMemory, recipientHistory, setPayment, upsertRequest, entryFor } from '../src/tenant-store.ts';
import { makeMemo, type SharedRequest } from '../src/domain.ts';

const A = 'NQ0700000000000000000000000000000000';
const B = 'NQ46YCNN4H64DNDLGFDDVU50YPJCMATF7A3H';
const id = (c: string) => c.repeat(32);
const req = (c: string, recipient = A): SharedRequest => ({ v: 1, chargeId: id(c), memo: makeMemo(id(c)), recipient, amountLuna: 100_000, period: '2026-11' });
const now = '2026-11-11T12:00:00.000Z';

test('tenant remembers requests and payments across visits', () => {
  let m = upsertRequest(emptyTenantMemory(), req('1'), now);
  m = upsertRequest(m, req('1'), now);
  assert.equal(m.entries.length, 1);
  m = setPayment(m, id('1'), { state: 'confirmed', hash: 'a'.repeat(64), at: now });
  const restored = parseTenantMemory(JSON.stringify(m));
  assert.equal(entryFor(restored, id('1'))?.payment?.state, 'confirmed');
  assert.deepEqual(restored.paidTo, [A]);
});

test('a new receiving address is flagged once the tenant has paid a landlord', () => {
  let m = upsertRequest(emptyTenantMemory(), req('1'), now);
  assert.equal(recipientHistory(m, A), 'FIRST_TIME');
  m = setPayment(m, id('1'), { state: 'confirmed', hash: 'a'.repeat(64), at: now });
  assert.equal(recipientHistory(m, A.replace(/(.{4})/g, '$1 ')), 'KNOWN');
  assert.equal(recipientHistory(m, B), 'CHANGED');
});

test('corrupted memory is ignored safely', () => {
  assert.deepEqual(parseTenantMemory('{'), emptyTenantMemory());
  const m = parseTenantMemory(JSON.stringify({ wallet: 'nope', paidTo: ['x', A], entries: [{ request: { v: 2 } }, { request: req('2') }] }));
  assert.equal(m.wallet, undefined);
  assert.deepEqual(m.paidTo, [A]);
  assert.equal(m.entries.length, 1);
});
