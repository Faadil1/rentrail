import assert from 'node:assert/strict';
import {test} from 'node:test';
import {addCharge,addUnit,addProperty,emptyPortfolio,makeMemo,recordSubmission,type Portfolio} from '../src/domain.ts';
import {buildCollectionQueue} from '../src/collections-queue.ts';
const recv='NQ07 0000 0000 0000 0000 0000 0000 0000 0000',date='2026-11-10T00:00:00Z';
function fixture():Portfolio{
 let p=emptyPortfolio();p=addProperty(p,{id:'b',name:'Westview',createdAt:date});
 for(const u of ['1','2','3'])p=addUnit(p,{id:u,propertyId:'b',label:'Unit '+u});
 return p;
}
function charge(p:Portfolio,id:string,unitId:string,period:string){
 return addCharge(p,{id,unitId,period,amountLuna:500,recipient:recv,memo:makeMemo(id),createdAt:date});
}
test('all 3 units require a local charge for the selected month',()=>{
 const q=buildCollectionQueue(fixture(),'2026-11');
 assert.equal(q.missingInvoices,3);assert.equal(q.totalActions,3);assert.equal(q.submittedForReview,0);
 assert.equal(q.actions[0].priority,'MISSING_INVOICE');
});
test('current-period charge appears as unmatched, never as legally overdue',()=>{
 const q=buildCollectionQueue(charge(fixture(),'a'.repeat(32),'1','2026-11'),'2026-11');
 assert.equal(q.currentPeriodUnmatched,1);assert.equal(q.missingInvoices,2);
 assert.equal(q.actions.find(x=>x.priority==='CURRENT_PERIOD_UNMATCHED')?.amountLuna,500);
});
test('historical charge is categorized only as past-period unmatched, not late rent',()=>{
 const q=buildCollectionQueue(charge(fixture(),'a'.repeat(32),'1','2026-10'),'2026-11');
 assert.equal(q.pastPeriodUnmatched,1);assert.equal(q.missingInvoices,3);
 assert.match(q.actions.find(x=>x.priority==='PAST_PERIOD_UNMATCHED')?.note||'',/Review/);
});
test('unknown payment status never credited',()=>{
 let p=charge(fixture(),'a'.repeat(32),'1','2026-11');
 p=recordSubmission(p,{chargeId:'a'.repeat(32),hash:null,state:'OUTCOME_UNKNOWN',createdAt:date});
 const q=buildCollectionQueue(p,'2026-11');
 assert.equal(q.submittedForReview,1);assert.equal(q.currentPeriodUnmatched,0);
 assert.equal(q.actions[0].amountLuna,500);
});
test('wallet hash still requires proof review',()=>{
 let p=charge(fixture(),'a'.repeat(32),'1','2026-11');
 p=recordSubmission(p,{chargeId:'a'.repeat(32),hash:'f'.repeat(64),state:'SUBMITTED_UNVERIFIED',createdAt:date});
 const q=buildCollectionQueue(p,'2026-11');
 assert.equal(q.submittedForReview,1);assert.equal(q.actions[0].priority,'SUBMITTED_NOT_VERIFIED');
});
test('does not treat historical unverified submission as verified',()=>{
 let p=charge(fixture(),'a'.repeat(32),'1','2026-10');
 p=recordSubmission(p,{chargeId:'a'.repeat(32),hash:'f'.repeat(64),state:'SUBMITTED_UNVERIFIED',createdAt:date});
 const q=buildCollectionQueue(p,'2026-11');
 assert.equal(q.pastPeriodUnmatched,0);assert.equal(q.missingInvoices,3);
});
test('filtered property excludes unrelated units and charges',()=>{
 let p=fixture();p=addProperty(p,{id:'other',name:'South',createdAt:date});
 p=addUnit(p,{id:'4',propertyId:'other',label:'Unit 4'});
 const q=buildCollectionQueue(p,'2026-11','other');
 assert.equal(q.missingInvoices,1);assert.equal(q.actions[0].propertyName,'South');
});
test('bad month is rejected',()=>assert.throws(()=>buildCollectionQueue(fixture(),'2026-00')));
test('empty portfolio results in empty actions',()=>assert.equal(buildCollectionQueue(emptyPortfolio(),'2026-11').totalActions,0));
test('repeat calculation does not mutate portfolio',()=>{
 const p=fixture();const before=JSON.stringify(p);buildCollectionQueue(p,'2026-11');
 assert.equal(JSON.stringify(p),before);
});
test('queue priority puts pending proof ahead of missing invoice',()=>{
 let p=charge(fixture(),'a'.repeat(32),'1','2026-11');
 p=recordSubmission(p,{chargeId:'a'.repeat(32),hash:'f'.repeat(64),state:'SUBMITTED_UNVERIFIED',createdAt:date});
 const q=buildCollectionQueue(p,'2026-11');
 assert.equal(q.actions[0].priority,'SUBMITTED_NOT_VERIFIED');
});
