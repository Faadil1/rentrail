import assert from 'node:assert/strict';
import { test } from 'node:test';
import { signedPaymentIntegrityError, payRentRequest, PayError } from '../src/payment.ts';
import { makeMemo, type SharedRequest } from '../src/domain.ts';
import { leaseRequest, type Lease } from '../src/lease.ts';

const id='a'.repeat(32);
const recipient='NQ07 0000 0000 0000 0000 0000 0000 0000 0000';
const req:SharedRequest={v:1,chargeId:id,recipient,amountLuna:1000,period:'2026-11',memo:makeMemo(id)};
const forged={publicKey:'b'.repeat(64),signature:'c'.repeat(128)};

test('unsigned request has no cryptographic integrity claim; UI still requires human address confirmation',()=>{
 assert.equal(signedPaymentIntegrityError(req),null);
});
test('forged signed request is rejected BEFORE Nimiq Pay provider is called',async()=>{
 const tampered={...req,sig:forged};
 assert.match(signedPaymentIntegrityError(tampered)||'',/invalid or modified/i);
 await assert.rejects(()=>payRentRequest(tampered),e=>e instanceof PayError&&e.kind==='INVALID_REQUEST');
});
test('forged signed monthly lease is rejected even when request fields match',async()=>{
 const lease:Lease={v:1,id:'d'.repeat(32),recipient,amountLuna:1000,start:'2026-11',dueDay:1,sig:forged};
 const rent=leaseRequest(lease,'2026-11');
 assert.match(signedPaymentIntegrityError(rent)||'',/signed monthly lease/i);
 await assert.rejects(()=>payRentRequest(rent),e=>e instanceof PayError&&e.kind==='INVALID_REQUEST');
});
test('changing a lease-derived monthly amount blocks payment even without a signature',()=>{
 const lease:Lease={v:1,id:'d'.repeat(32),recipient,amountLuna:1000,start:'2026-11',dueDay:1};
 const changed={...leaseRequest(lease,'2026-11'),amountLuna:2000};
 assert.match(signedPaymentIntegrityError(changed)||'',/does not match/i);
});
test('conflicting one-time signature and monthly lease cannot bypass lease integrity',()=>{
 const lease:Lease={v:1,id:'d'.repeat(32),recipient,amountLuna:1000,start:'2026-11',dueDay:1};
 assert.match(signedPaymentIntegrityError({...leaseRequest(lease,'2026-11'),sig:forged})||'',/Conflicting/i);
});
