import assert from 'node:assert/strict';
import {test} from 'node:test';
import {addCharge,addProperty,addUnit,emptyPortfolio,makeMemo,type Portfolio} from '../src/domain.ts';
import {casebookSummary,saveObservedMatch,validateCasebook,type PaymentCasebook} from '../src/evidence-casebook.ts';
import {type VerifyResult} from '../src/rpc.ts';
const date='2026-11-10T18:10:00.000Z',id='a'.repeat(32),id2='b'.repeat(32),hash='c'.repeat(64);
let p:Portfolio=emptyPortfolio();
p=addProperty(p,{id:'p',name:'House',createdAt:date});
p=addUnit(p,{id:'u',propertyId:'p',label:'Unit'});
p=addUnit(p,{id:'v',propertyId:'p',label:'Suite'});
p=addCharge(p,{id,unitId:'u',period:'2026-11',amountLuna:1000,recipient:'NQ07 0000 0000 0000 0000 0000 0000 0000 0000',memo:makeMemo(id),createdAt:date});
p=addCharge(p,{id:id2,unitId:'v',period:'2026-11',amountLuna:300,recipient:'NQ07 0000 0000 0000 0000 0000 0000 0000 0000',memo:makeMemo(id2),createdAt:date});
const empty:PaymentCasebook={version:1,entries:[]};
const result:VerifyResult={state:'FINAL_MATCHED',message:'Exact match from history node',evidenceSource:'single-public-rpc',
 rpcUrl:'https://rpc.nimiqwatch.com/',observedAt:date,hash,network:'MainAlbatross',blockHeight:66504678,macroHeight:66504720,amountLuna:500};
test('observed partial transfer stored with explicit single-RPC provenance',()=>{
 const b=saveObservedMatch(empty,p,id,result);
 assert.equal(b.entries.length,1);
 assert.equal(b.entries[0].source,'single-public-rpc');
 assert.deepEqual(casebookSummary(b,p,id),{observedLuna:500,observations:1,unmatchedLuna:500,overLimit:false});
});
test('two independently observed hashes can partially fulfill one local request without legal settlement claim',()=>{
 const b=saveObservedMatch(saveObservedMatch(empty,p,id,result),p,id,{...result,hash:'d'.repeat(64),amountLuna:500});
 assert.equal(casebookSummary(b,p,id).unmatchedLuna,0);
 assert.equal(b.entries[1].source,'single-public-rpc');
});
test('a blockchain hash cannot be assigned to two rent charges',()=>{
 const b=saveObservedMatch(empty,p,id,result);
 assert.throws(()=>saveObservedMatch(b,p,id2,{...result,amountLuna:200}),/already/);
});
test('a hash cannot be duplicated on same invoice',()=>{
 const b=saveObservedMatch(empty,p,id,result);
 assert.throws(()=>saveObservedMatch(b,p,id,result),/already/);
});
test('observation cannot exceed invoice amount',()=>assert.throws(()=>saveObservedMatch(empty,p,id2,result),/exceeds/));
test('unfinalized observation must never be persisted',()=>assert.throws(()=>saveObservedMatch(empty,p,id,{...result,state:'INCLUDED_NOT_FINAL'}),/Only complete/));
test('failed transfer is not proof',()=>assert.throws(()=>saveObservedMatch(empty,p,id,{...result,state:'REVIEW_REQUIRED'}),/Only complete/));
test('other network is rejected',()=>assert.throws(()=>saveObservedMatch(empty,p,id,{...result,network:'UNVERIFIED'}),/Only complete/));
test('missing macroblock is rejected',()=>assert.throws(()=>saveObservedMatch(empty,p,id,{...result,macroHeight:undefined}),/Only complete/));
test('unknown charge is rejected',()=>assert.throws(()=>saveObservedMatch(empty,p,'f'.repeat(32),result),/real local/));
test('fake URL cannot become evidence',()=>assert.throws(()=>saveObservedMatch(empty,p,id,{...result,rpcUrl:'https://evil.example/'}),/Only complete/));
test('loaded fabricated PAID status cannot enter casebook',()=>{
 const b=saveObservedMatch(empty,p,id,result);
 assert.throws(()=>validateCasebook({version:1,entries:[{...b.entries[0],source:'trusted-legal-receipt'}]},p));
});
test('tampered macroblock before inclusion is rejected',()=>{
 const b=saveObservedMatch(empty,p,id,result);
 assert.throws(()=>validateCasebook({version:1,entries:[{...b.entries[0],macroHeight:10}]},p));
});
test('casebook cannot import observations for absent charges',()=>{
 const b=saveObservedMatch(empty,p,id,result);
 assert.throws(()=>validateCasebook(b,emptyPortfolio()));
});
test('oversized evidence journal is rejected',()=>assert.throws(()=>validateCasebook({version:1,entries:Array(301).fill(null)},p)));
test('casebook summary for unmatched charge is full outstanding',()=>assert.deepEqual(casebookSummary(empty,p,id2),{
 observedLuna:0,observations:0,unmatchedLuna:300,overLimit:false
}));
