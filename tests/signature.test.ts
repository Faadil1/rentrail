import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addressFromPublicKey, verifySignedMessage, normalizeSignResult, rentRequestMessage, sameAddress, decodeBytes } from '../src/signature.ts';

// Vector generated with the official @nimiq/core 2.23 library (KeyPair.sign over SHA-256 of the prefixed message).
const V = {
  pub: 'e734ea6c2b6257de72355e472aa05a4c487e6b463c029ed306df2f01b5636b58',
  addr: 'NQ46 YCNN 4H64 DNDL GFDD VU50 YPJC MATF 7A3H',
  msg: 'RentRail test message',
  sig: '5184c53e5f0f5ff0c6f84dec5d2b3f61160828dc571927678a15c2f89b55ef47ad1fadaf321bdfb4c1681e81449c148cc631384b72ca88f379891909b7fa0a03',
};

test('address derivation matches Nimiq core', () => {
  assert.equal(addressFromPublicKey(decodeBytes(V.pub, 32)!), V.addr);
});

test('a Nimiq signed message verifies and yields the signer address', () => {
  const r = verifySignedMessage(V.msg, { publicKey: V.pub, signature: V.sig });
  assert.deepEqual(r, { valid: true, signer: V.addr });
});

test('a tampered message or signature is rejected', () => {
  assert.equal(verifySignedMessage(V.msg + '!', { publicKey: V.pub, signature: V.sig }).valid, false);
  const badSig = V.sig.slice(0, -2) + '04';
  assert.equal(verifySignedMessage(V.msg, { publicKey: V.pub, signature: badSig }).valid, false);
  assert.equal(verifySignedMessage(V.msg, { publicKey: 'zz', signature: V.sig }).valid, false);
  assert.equal(verifySignedMessage(V.msg, null).valid, false);
});

test('sign results in hex, base64 or byte arrays are normalized', () => {
  const bytes = (h: string) => Array.from(h.match(/.{2}/g)!, b => parseInt(b, 16));
  assert.deepEqual(normalizeSignResult({ publicKey: bytes(V.pub), signature: bytes(V.sig) }), { publicKey: V.pub, signature: V.sig });
  const b64 = (h: string) => Buffer.from(h, 'hex').toString('base64');
  assert.deepEqual(normalizeSignResult({ publicKey: b64(V.pub), signature: b64(V.sig) }), { publicKey: V.pub, signature: V.sig });
  assert.equal(normalizeSignResult({ publicKey: 'x' }), null);
});

test('the signed request text binds address, amount, month and reference', () => {
  const m = rentRequestMessage({ recipient: V.addr, amountLuna: 125_000, period: '2026-11', memo: 'RR1:' + 'a'.repeat(32) });
  assert.match(m, /Pay to: NQ46YCNN4H64DNDLGFDDVU50YPJCMATF7A3H/);
  assert.match(m, /Amount: 1.25 NIM \(125000 Luna\)/);
  assert.match(m, /Month: 2026-11/);
  assert.ok(sameAddress(V.addr, V.addr.replace(/ /g, '')));
});
