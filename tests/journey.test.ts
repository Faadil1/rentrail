import assert from 'node:assert/strict';
import {test} from 'node:test';
import {emptyPortfolio,addProperty,addUnit,addCharge,makeMemo} from '../src/domain.ts';
import {validAudience,journeySteps,parseManualPaymentReview,describeManualProof,statusExplanations} from '../src/journey.ts';

const addr='NQ07 0000 0000 0000 0000 0000 0000 0000 0000';
const id='a'.repeat(32),hash='b'.repeat(64);
function fields(){return {hash,recipient:addr,memo:makeMemo(id),amountNim:'0.005'};}
test('audience selection is allowlisted, not account authentication',()=>{
 assert.equal(validAudience('owner'),true);
 assert.equal(validAudience('tenant'),true);
 assert.equal(validAudience('explorer'),true);
 assert.equal(validAudience('admin'),false);
 assert.equal(validAudience({role:'owner'}),false);
});
test('owner journey shows four concrete product steps ending in the monthly review',()=>{
 const j=journeySteps('owner',emptyPortfolio());
 assert.equal(j.length,4);assert.equal(j[0].state,'READY');
 assert.equal(j[1].view,'charges');assert.equal(j[3].view,'collections');
});
test('local property, unit and charge steps indicate local setup only, never paid',()=>{
 let p=emptyPortfolio();
 p=addProperty(p,{id:'1'.repeat(32),name:'Cedar',createdAt:'2026-11-10T00:00:00Z'});
 p=addUnit(p,{id:'2'.repeat(32),propertyId:'1'.repeat(32),label:'1B'});
 p=addCharge(p,{id,unitId:'2'.repeat(32),period:'2026-11',amountLuna:500,recipient:addr,memo:makeMemo(id),createdAt:'2026-11-10T00:00:00Z'});
 const j=journeySteps('owner',p);
 assert.equal(j[0].state,'LOCAL_DONE');assert.equal(j[1].state,'LOCAL_DONE');
 assert.equal(j[3].state,'READY');
 assert.equal(journeySteps('owner',p,true)[3].state,'LOCAL_DONE');
});
test('tenant journey starts from the landlord link and pays in Nimiq Pay',()=>{
 const j=journeySteps('tenant',emptyPortfolio());
 assert.equal(j[0].state,'GUIDANCE_ONLY');assert.equal(j[0].action,'instructions');
 assert.match(j[1].description,/Nimiq Pay wallet/);
 assert.equal(j[2].view,'wallet');
});
test('explorer can inspect fictional sample without payment',()=>{
 const j=journeySteps('explorer',emptyPortfolio());assert.equal(j[0].action,'preview');
 assert.equal(j[1].view,'collections');assert.equal(j[2].view,'wallet');
});
test('exact standalone proof lookup accepts valid NQ and 0.005 NIM',()=>{
 const x=parseManualPaymentReview(fields());
 assert.equal(x.amountLuna,500);assert.equal(x.recipient,addr);
 assert.equal(x.memo,'STUB1:'+id);assert.equal(x.hash,hash);
 assert.equal(x.allowPartial,true);
});
test('standalone lookup trims hash and normalizes NQ case and whitespace',()=>{
 const f=fields();f.hash=' '+hash.toUpperCase()+' ';f.recipient=addr.toLowerCase().replaceAll(' ','');
 const v=parseManualPaymentReview(f);
 assert.equal(v.recipient,addr);assert.equal(v.hash,hash);
});
test('nonhex hash rejected before any RPC read',()=>assert.throws(()=>parseManualPaymentReview({...fields(),hash:'z'.repeat(64)}),/64 hexadecimal/));
test('short or blank hash rejected',()=>{
 for(const x of ['','123',hash.slice(0,63)])assert.throws(()=>parseManualPaymentReview({...fields(),hash:x}),/64 hexadecimal/);
});
test('incorrect NQ checksum rejected before RPC read',()=>{
 assert.throws(()=>parseManualPaymentReview({...fields(),recipient:'NQ01 1111 1111 1111 1111 1111 1111 1111 1111'}),/checksum/);
});
test('empty recipient rejected',()=>assert.throws(()=>parseManualPaymentReview({...fields(),recipient:''}),/valid Nimiq/));
test('wrong memo prefix rejected',()=>assert.throws(()=>parseManualPaymentReview({...fields(),memo:'TX:'+id}),/STUB1:/));
test('wrong reference length rejected',()=>assert.throws(()=>parseManualPaymentReview({...fields(),memo:'STUB1:'+id.slice(0,30)}),/STUB1:/));
test('blank NIM rejected',()=>assert.throws(()=>parseManualPaymentReview({...fields(),amountNim:''}),/positive/));
test('too many decimal digits rejected',()=>assert.throws(()=>parseManualPaymentReview({...fields(),amountNim:'0.000001'}),/five decimal/));
test('zero or negative NIM rejected',()=>{
 for(const amountNim of ['0','-1'])assert.throws(()=>parseManualPaymentReview({...fields(),amountNim}),/positive/);
});
test('large unsafe NIM values rejected',()=>assert.throws(()=>parseManualPaymentReview({...fields(),amountNim:'9007199254740991'}),/safe integer/));
test('glossary has four human-readable non-false states',()=>{
 assert.equal(statusExplanations.length,4);
 assert.match(statusExplanations[1].description,/waiting for the network to confirm/);
 assert.match(statusExplanations[2].description,/exact amount.*right address.*reference.*finalized/);
});

test('full node-reported match is exact but never a legal receipt',()=>{
 const r=describeManualProof(500,500,'FINAL_MATCHED');
 assert.equal(r.kind,'EXACT_NODE_MATCH');assert.equal(r.remainingLuna,0);
});
test('partial node-reported transfer displays residual NIM rather than falsely settled',()=>{
 const r=describeManualProof(500,250,'FINAL_MATCHED');
 assert.equal(r.kind,'PARTIAL_NODE_MATCH');assert.equal(r.remainingLuna,250);
});
test('overpayment is review required, not a fully paid status',()=>{
 const r=describeManualProof(500,750,'FINAL_MATCHED');
 assert.equal(r.kind,'REVIEW_REQUIRED');assert.equal(r.remainingLuna,null);
});
test('submitted hash or unfinalized claim is never treated as verified',()=>{
 for(const state of ['SUBMITTED_UNVERIFIED','INCLUDED_NOT_FINAL','UNKNOWN','NOT_FOUND','REVIEW_REQUIRED']){
  assert.equal(describeManualProof(500,500,state).kind,'REVIEW_REQUIRED');
 }
});
test('zero/negative/unsafe amount does not generate a payment claim',()=>{
 for(const amount of [0,-1,0.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1]){
  assert.equal(describeManualProof(amount,500,'FINAL_MATCHED').kind,'REVIEW_REQUIRED');
 }
});
