import assert from 'node:assert/strict';
import {test} from 'node:test';
import { addProofClaim,removeProofClaim,parseProofClaims,reconcileClaimedCharge,saveProofClaims,loadProofClaims,PROOF_FRESH_MS,MAX_CLAIMS_PER_CHARGE, type ProofClaim } from '../src/proof-desk.ts';
import type { Charge } from '../src/domain.ts';
import type { VerifyResult } from '../src/rpc.ts';

const id='a'.repeat(32),otherId='b'.repeat(32),h1='1'.repeat(64),h2='2'.repeat(64),h3='3'.repeat(64);
const at='2026-11-10T15:00:00.000Z',now=Date.parse(at);
const charge:Charge={id,unitId:'c'.repeat(32),period:'2026-11',recipient:'NQ48 HR14 MN5P GHYP YTL4 E2PN SHYK 35UA E1QT',amountLuna:1000,memo:'RR1:'+id,createdAt:at};
const claim=(hash=h1,chargeId=id):ProofClaim=>({hash,chargeId,recordedAt:at});
const proof=(hash=h1,amountLuna=500,state:VerifyResult['state']='FINAL_MATCHED'):VerifyResult=>({
 state,message:'Node reports confirmed',hash,amountLuna,network:'MainAlbatross',
 observedAt:at,rpcUrl:'https://rpc.nimiqwatch.com/',evidenceSource:'single-public-rpc'
});
test('claims are stored as hash references only, not claimed finality',()=>{
 const c=addProofClaim([],id,h1,[id],at);
 assert.deepEqual(c,[claim()]);assert.equal(Object.keys(c[0]).includes('status'),false);
});
test('reject hash with short invalid structure',()=>assert.throws(()=>addProofClaim([],id,'abc',[id],at),/64-hex/));
test('reject unknown rent charge ID',()=>assert.throws(()=>addProofClaim([],otherId,h1,[id],at),/known/));
test('reject duplicated transaction within charge',()=>assert.throws(()=>addProofClaim([claim()],id,h1,[id],at),/already tracked/));
test('reject same transaction claimed for another charge',()=>assert.throws(()=>addProofClaim([claim()],otherId,h1,[id,otherId],at),/already tracked/));
test('normalizes uppercase transaction hashes',()=>assert.equal(addProofClaim([],id,'A'.repeat(64),[id],at)[0].hash,'a'.repeat(64)));
test('remove only the chosen charge-hash reference',()=>{
 const a=[claim(),claim(h2),claim(h3,otherId)];
 assert.deepEqual(removeProofClaim(a,id,h2),[claim(),claim(h3,otherId)]);
});
test('reject invalid persisted collection / duplicate hash',()=>{
 assert.throws(()=>parseProofClaims({}),/collection/);
 assert.throws(()=>parseProofClaims([claim(),claim(h1,otherId)]),/Duplicate/);
});
test('reject more than eight hashes on one charge',()=>{
 const refs=Array.from({length:MAX_CLAIMS_PER_CHARGE+1},(_,i)=>claim(i.toString(16).padStart(64,'0')));
 assert.throws(()=>parseProofClaims(refs),/Too many/);
});
test('reject persisted fake finality as structurally invalid shape of date',()=>{
 assert.throws(()=>parseProofClaims([{chargeId:id,hash:h1,recordedAt:'no-date',state:'FINAL_MATCHED'}]),/date/);
});
test('load corrupted cache fails closed with no credited proof',()=>{
 const store={getItem(){return '{bad'},setItem(){}};
 assert.deepEqual(loadProofClaims(store),[]);
});
test('save and restore never manufacture remote status',()=>{
 let memory='';
 const store={getItem(){return memory},setItem(_k:string,value:string){memory=value}};
 saveProofClaims([claim()],store);
 assert.deepEqual(loadProofClaims(store),[claim()]);
 assert.equal(memory.includes('FINAL_MATCHED'),false);
});
test('not rechecked means zero credited and full amount due',()=>{
 const x=reconcileClaimedCharge(charge,[claim()],{},[],now);
 assert.equal(x.verified,0);assert.equal(x.unresolved,1);assert.equal(x.summary.creditedLuna,0);
 assert.equal(x.summary.dueLuna,1000);assert.equal(x.report,'NEEDS_FRESH_RECHECK');
});
test('one final matching payment credits only partial amount',()=>{
 const x=reconcileClaimedCharge(charge,[claim()],{[h1]:proof()},[],now);
 assert.equal(x.summary.status,'PARTIALLY_FUNDED');assert.equal(x.summary.creditedLuna,500);
 assert.equal(x.summary.dueLuna,500);assert.equal(x.report,'NODE_REPORTED');
});
test('two final matching transactions add to exact request',()=>{
 const x=reconcileClaimedCharge(charge,[claim(),claim(h2)],{[h1]:proof(),[h2]:proof(h2)},[],now);
 assert.equal(x.summary.status,'PAID_ONCHAIN_VERIFIED');assert.equal(x.summary.creditedLuna,1000);assert.equal(x.summary.dueLuna,0);
});
test('unverified receipt never gets balance credit',()=>{
 const x=reconcileClaimedCharge(charge,[claim()],{[h1]:proof(h1,500,'INCLUDED_NOT_FINAL')},[],now);
 assert.equal(x.summary.creditedLuna,0);assert.equal(x.rejected,1);
});
test('recipient-error or amount mismatch state is flagged and not credited',()=>{
 const x=reconcileClaimedCharge(charge,[claim()],{[h1]:proof(h1,500,'REVIEW_REQUIRED')},[],now);
 assert.equal(x.summary.creditedLuna,0);assert.equal(x.rejected,1);
});
test('wrong tx hash in node response must not credit',()=>{
 const x=reconcileClaimedCharge(charge,[claim()],{[h1]:proof(h2)},[],now);
 assert.equal(x.verified,0);assert.equal(x.summary.creditedLuna,0);
});
test('wrong network in result must not credit',()=>{
 const x=reconcileClaimedCharge(charge,[claim()],{[h1]:{...proof(),network:'UNVERIFIED'}},[],now);
 assert.equal(x.verified,0);assert.equal(x.summary.creditedLuna,0);
});
test('stale remote result cannot be reused after freshness window',()=>{
 const x=reconcileClaimedCharge(charge,[claim()],{[h1]:proof()},[],now+PROOF_FRESH_MS+1);
 assert.equal(x.summary.creditedLuna,0);assert.equal(x.unresolved,1);assert.equal(x.details[0].state,'EXPIRED');
});
test('future node timestamp outside skew is rejected',()=>{
 const x=reconcileClaimedCharge(charge,[claim()],{[h1]:proof()},[],now-120001);
 assert.equal(x.summary.creditedLuna,0);
});
test('malformed / negative amount never credited',()=>{
 const x=reconcileClaimedCharge(charge,[claim()],{[h1]:proof(h1,-1)},[],now);
 assert.equal(x.summary.creditedLuna,0);
});
test('two submitted hashes only, no RPC, cannot be marked settled',()=>{
 const x=reconcileClaimedCharge(charge,[claim(),claim(h2)],{},[{chargeId:id,hash:h1,state:'SUBMITTED_UNVERIFIED',createdAt:at}],now);
 assert.equal(x.summary.status,'SUBMITTED_UNVERIFIED');assert.equal(x.summary.creditedLuna,0);
});
test('overpaid collection is REVIEW_REQUIRED not fully settled',()=>{
 const x=reconcileClaimedCharge(charge,[claim(),claim(h2)],{[h1]:proof(h1,750),[h2]:proof(h2,750)},[],now);
 assert.equal(x.summary.status,'REVIEW_REQUIRED');assert.equal(x.summary.creditedLuna,1500);
 assert.equal(x.summary.dueLuna,0);
});
