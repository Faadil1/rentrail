import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  parseNim, formatNim, makeMemo, createId, addProperty, addUnit, addCharge,
  emptyPortfolio, projectCharge, recordSubmission, validateSharedRequest,
  shareableRequest, looksLikeNimiqAddress, type Charge, type TransferEvidence,
} from '../src/domain.ts';

const address = 'NQ07 0000 0000 0000 0000 0000 0000 0000 0000';
const id = '0123456789abcdef0123456789abcdef';
const hash = 'a'.repeat(64);
const memo = makeMemo(id);
function charge(): Charge { return { id, unitId:'unit', period:'2026-11', amountLuna:250_000, recipient:address, memo, createdAt:'2026-11-09T00:00:00Z' }; }
function transfer(overrides:Partial<TransferEvidence> = {}):TransferEvidence {
  return {network:'nimiq-mainnet',hash,recipient:address,memo,amountLuna:250_000,status:'FINAL_VERIFIED',...overrides};
}
test('parses whole NIM to Luna exactly',()=>assert.equal(parseNim('12'),1_200_000));
test('parses fractional NIM to Luna exactly',()=>assert.equal(parseNim('1.00001'),100_001));
test('formats fractional values without float drift',()=>assert.equal(formatNim(100_001),'1.00001'));
test('formats zero NIM',()=>assert.equal(formatNim(0),'0'));
test('rejects excess fraction digits',()=>assert.throws(()=>parseNim('1.000001')));
test('rejects scientific notation',()=>assert.throws(()=>parseNim('1e2')));
test('rejects negative amounts',()=>assert.throws(()=>parseNim('-1')));
test('rejects zero amounts',()=>assert.throws(()=>parseNim('0')));
test('rejects amount overflow',()=>assert.throws(()=>parseNim('9007199254740993')));
test('rejects invalid formatted Luna',()=>assert.throws(()=>formatNim(2.5)));
test('opaque reference has no tenant info and fits 64 bytes',()=>assert.ok(new TextEncoder().encode(memo).length<=64));
test('reference requires 16 bytes of randomness',()=>assert.throws(()=>createId(new Uint8Array(3))));
test('reference from bytes is deterministic',()=>assert.equal(createId(new Uint8Array(16).fill(10)),'0a'.repeat(16)));
test('rejects invalid reference',()=>assert.throws(()=>makeMemo('rent-november-tenant')));
test('recognizes normalized structural NQ address',()=>assert.equal(looksLikeNimiqAddress(address),true));
test('rejects malformed NQ address',()=>assert.equal(looksLikeNimiqAddress('NQ00 INVALID'),false));
test('property then unit can be created',()=>{
  const p=addProperty(emptyPortfolio(),{id:'prop',name:'One',createdAt:'now'});
  assert.equal(addUnit(p,{id:'unit',propertyId:'prop',label:'A1'}).units.length,1);
});
test('unit requires existing property',()=>assert.throws(()=>addUnit(emptyPortfolio(),{id:'unit',propertyId:'missing',label:'A1'})));
function oneUnit(){return addUnit(addProperty(emptyPortfolio(),{id:'prop',name:'One',createdAt:'now'}),{id:'unit',propertyId:'prop',label:'A1'});}
test('charge must reference a real unit',()=>assert.throws(()=>addCharge(emptyPortfolio(),charge())));
test('charge can be created for unit and period',()=>assert.equal(addCharge(oneUnit(),charge()).charges.length,1));
test('charge cannot be duplicated by unit and period',()=>{
  const p=addCharge(oneUnit(),charge());
  assert.throws(()=>addCharge(p,{...charge(),id:'another',memo:makeMemo('a'.repeat(32))}));
});
test('charge period must be month format',()=>assert.throws(()=>addCharge(oneUnit(),{...charge(),period:'Nov 2026'})));
test('charge recipient must be structurally Nimiq',()=>assert.throws(()=>addCharge(oneUnit(),{...charge(),recipient:'abc'})));
test('empty chain evidence is OPEN',()=>assert.equal(projectCharge(charge(),[]).status,'OPEN'));
test('a pending wallet hash is not paid',()=>{
  const p=addCharge(oneUnit(),charge());
  const withSubmission=recordSubmission(p,{chargeId:id,state:'SUBMITTED_UNVERIFIED',hash,createdAt:'now'});
  assert.equal(projectCharge(charge(),[],withSubmission.submissions).status,'SUBMITTED_UNVERIFIED');
});
test('unknown wallet outcome is not paid',()=>{
  const p=addCharge(oneUnit(),charge());
  const next=recordSubmission(p,{chargeId:id,state:'OUTCOME_UNKNOWN',hash:null,createdAt:'now'});
  assert.equal(projectCharge(charge(),[],next.submissions).status,'SUBMITTED_UNVERIFIED');
});
test('cannot record second unresolved submission blindly',()=>{
  const p=addCharge(oneUnit(),charge());
  const next=recordSubmission(p,{chargeId:id,state:'OUTCOME_UNKNOWN',hash:null,createdAt:'now'});
  assert.throws(()=>recordSubmission(next,{chargeId:id,state:'SUBMITTED_UNVERIFIED',hash,createdAt:'now'}));
});
test('one valid final mainnet transfer credits rent',()=>{
  const v=projectCharge(charge(),[transfer()]);
  assert.equal(v.status,'PAID_ONCHAIN_VERIFIED');assert.equal(v.creditedLuna,250_000);
});
test('partial final transfer leaves balance due',()=>{
  const v=projectCharge(charge(),[transfer({amountLuna:100_000})]);
  assert.equal(v.status,'PARTIALLY_FUNDED');assert.equal(v.dueLuna,150_000);
});
test('two unique partial transfers can sum exactly',()=>{
  const v=projectCharge(charge(),[transfer({amountLuna:100_000}),transfer({hash:'b'.repeat(64),amountLuna:150_000})]);
  assert.equal(v.status,'PAID_ONCHAIN_VERIFIED');assert.equal(v.verifiedHashes.length,2);
});
test('duplicate tx hash triggers review and no double credit',()=>{
  const v=projectCharge(charge(),[transfer({amountLuna:100_000}),transfer({amountLuna:100_000})]);
  assert.equal(v.status,'REVIEW_REQUIRED');assert.equal(v.creditedLuna,100_000);
});
test('testnet payment is NEVER final mainnet rent',()=>{
  const v=projectCharge(charge(),[transfer({network:'nimiq-testnet'})]);
  assert.equal(v.status,'REVIEW_REQUIRED');assert.equal(v.creditedLuna,0);
});
test('wrong recipient does not credit rent',()=>{
  const v=projectCharge(charge(),[transfer({recipient:'NQ88 0000 0000 0000 0000 0000 0000 0000 0000'})]);
  assert.equal(v.status,'REVIEW_REQUIRED');assert.equal(v.creditedLuna,0);
});
test('wrong period reference does not credit rent',()=>{
  const v=projectCharge(charge(),[transfer({memo:'RR1:'+'b'.repeat(32)})]);
  assert.equal(v.status,'REVIEW_REQUIRED');assert.equal(v.creditedLuna,0);
});
test('included but not final does not credit rent',()=>{
  const v=projectCharge(charge(),[transfer({status:'INCLUDED_NOT_FINAL'})]);
  assert.equal(v.status,'REVIEW_REQUIRED');assert.equal(v.creditedLuna,0);
});
test('submitted but not verified does not credit rent',()=>{
  const v=projectCharge(charge(),[transfer({status:'SUBMITTED_UNVERIFIED'})]);
  assert.equal(v.status,'REVIEW_REQUIRED');assert.equal(v.creditedLuna,0);
});
test('malformed tx hash does not credit rent',()=>{
  const v=projectCharge(charge(),[transfer({hash:'fake'})]);
  assert.equal(v.status,'REVIEW_REQUIRED');assert.equal(v.creditedLuna,0);
});
test('invalid transfer amount does not credit rent',()=>{
  const v=projectCharge(charge(),[transfer({amountLuna:-2})]);
  assert.equal(v.status,'REVIEW_REQUIRED');assert.equal(v.creditedLuna,0);
});
test('overpayment is held for manual review',()=>{
  const v=projectCharge(charge(),[transfer({amountLuna:300_000})]);
  assert.equal(v.status,'REVIEW_REQUIRED');assert.equal(v.creditedLuna,300_000);
});
test('shared link roundtrip is structurally valid',()=>{
  const v=validateSharedRequest(shareableRequest(charge()));
  assert.equal(v.memo,memo);assert.equal(v.amountLuna,250_000);
});
test('shared request cannot mismatch memo and charge id',()=>assert.throws(()=>validateSharedRequest({...shareableRequest(charge()),memo:'RR1:'+'a'.repeat(32)})));
test('shared request cannot include invalid amount',()=>assert.throws(()=>validateSharedRequest({...shareableRequest(charge()),amountLuna:0})));
test('shared request cannot target non NQ recipient',()=>assert.throws(()=>validateSharedRequest({...shareableRequest(charge()),recipient:'0xabcdef'})));