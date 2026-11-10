import assert from 'node:assert/strict';
import {test} from 'node:test';
import {collectionQueue,collectionCsv,dueDateFor,reminderDraft,utcCalendarDate,validDueDay} from '../src/collections.ts';
import {emptyPortfolio,addProperty,addUnit,addCharge,recordSubmission,type Portfolio} from '../src/domain.ts';
const a='a'.repeat(32),b='b'.repeat(32),c='c'.repeat(32),d='d'.repeat(32),prop='1'.repeat(32);
const receiver='NQ07 0000 0000 0000 0000 0000 0000 0000 0000';
function fixture():Portfolio{
 let p=emptyPortfolio();
 p=addProperty(p,{id:prop,name:'Harbour House',createdAt:'2026-10-01T00:00:00Z'});
 p=addUnit(p,{id:a,propertyId:prop,label:'A-1'});
 p=addUnit(p,{id:b,propertyId:prop,label:'B-2'});
 p=addCharge(p,{id:c,unitId:a,period:'2026-10',amountLuna:250_000,recipient:receiver,memo:'RR1:'+c,createdAt:'2026-10-01T00:00:00Z'});
 p=addCharge(p,{id:d,unitId:b,period:'2026-11',amountLuna:200_000,recipient:receiver,memo:'RR1:'+d,createdAt:'2026-10-01T00:00:00Z'});
 return p;
}
test('default due date is first of month',()=>assert.equal(dueDateFor('2026-11'),'2026-11-01'));
test('custom 28th due day is legal in February',()=>assert.equal(dueDateFor('2027-02',28),'2027-02-28'));
test('invalid due day 0 /29/float/NaN rejected',()=>{
 for(const x of [0,29,1.5,NaN,Infinity,-2]){assert.equal(validDueDay(x),false);assert.throws(()=>dueDateFor('2026-11',x));}
});
test('2026-02-29 invalid calendar day rejected',()=>assert.throws(()=>utcCalendarDate('2026-02-29')));
test('invalid date format rejected',()=>assert.throws(()=>utcCalendarDate('11/10/2026')));
test('upcoming, due and overdue follow exact UTC calendar day',()=>{
 const p=fixture();
 const q=collectionQueue(p,'2026-11-01',{[a]:28,[b]:1});
 assert.equal(q.lines.find(l=>l.chargeId===c)!.daysLate,4);
 assert.equal(q.lines.find(l=>l.chargeId===d)!.ageBucket,'DUE_TODAY');
 assert.equal(q.overdueLuna,250_000);
});
test('aging reaches 31+ days and sorted by due date',()=>{
 const q=collectionQueue(fixture(),'2026-12-05');
 assert.deepEqual(q.lines.map(l=>l.chargeId),[c,d]);
 assert.equal(q.lines[0].ageBucket,'31+ DAYS');
 assert.equal(q.lines[1].ageBucket,'31+ DAYS');
 assert.equal(q.overdueCount,2);assert.equal(q.outstandingLuna,450_000);
});
test('future due date stays UPCOMING, does not overstate arrears',()=>{
 const q=collectionQueue(fixture(),'2026-10-01',{[a]:28,[b]:28});
 assert.equal(q.lines[0].ageBucket,'UPCOMING');assert.equal(q.overdueCount,0);
});
test('submitted wallet hash remains awaiting verification, not paid',()=>{
 let p=fixture();
 p=recordSubmission(p,{chargeId:c,hash:'f'.repeat(64),state:'SUBMITTED_UNVERIFIED',createdAt:'2026-10-02T00:00:00Z'});
 const q=collectionQueue(p,'2026-11-12');
 assert.equal(q.awaitingProofCount,1);assert.equal(q.outstandingLuna,450_000);
 assert.equal(q.lines[0].state,'TX_NEEDS_VERIFICATION');
 assert.match(reminderDraft(q.lines[0]),/pending review/);
});
test('reminders are drafts and do not claim a verified debt',()=>{
 const line=collectionQueue(fixture(),'2026-11-10').lines[0];
 const draft=reminderDraft(line);
 assert.match(draft,/local records do not yet contain independently verified payment evidence/);
 assert.match(draft,/This message is a draft, not proof of debt/);
});
test('property filter has exact amounts and rejects fake property',()=>{
 const p=fixture();
 assert.equal(collectionQueue(p,'2026-11-10',{},prop).lines.length,2);
 assert.throws(()=>collectionQueue(p,'2026-11-10',{},'invalid'));
});
test('invalid saved due rules fail closed',()=>assert.throws(()=>collectionQueue(fixture(),'2026-11-10',{[a]:31})));
test('local CSV export includes correct headers and no wallet NQ address',()=>{
 const csv=collectionCsv(collectionQueue(fixture(),'2026-11-10'));
 assert.match(csv,/local_status/);assert.match(csv,/Harbour House/);
 assert.equal(csv.includes(receiver),false);assert.equal(csv.includes('RR1:'),false);
});
test('CSV neutralizes spreadsheet formulas in names',()=>{
 let p=emptyPortfolio();p=addProperty(p,{id:prop,name:'=HYPERLINK("bad")',createdAt:'2026-10-01T00:00:00Z'});
 p=addUnit(p,{id:a,propertyId:prop,label:'@SUM(2,2)'});
 p=addCharge(p,{id:c,unitId:a,period:'2026-11',amountLuna:250,recipient:receiver,memo:'RR1:'+c,createdAt:'2026-10-01T00:00:00Z'});
 const csv=collectionCsv(collectionQueue(p,'2026-11-10'));
 assert.match(csv,/"'=HYPERLINK/);assert.match(csv,/"'@SUM/);
});
test('empty portfolio has zero metrics, no fabricated payments',()=>{
 const q=collectionQueue(emptyPortfolio(),'2026-11-10');assert.deepEqual(q.lines,[]);
 assert.equal(q.outstandingLuna,0);assert.equal(q.overdueCount,0);
});
