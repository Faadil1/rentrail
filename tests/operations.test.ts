import assert from 'node:assert/strict';
import {test} from 'node:test';
import {
  addProperty, addUnit, addCharge, emptyPortfolio, parseNim, makeMemo,
  recordSubmission, type Portfolio, type Charge
} from '../src/domain.ts';
import {nextMonth,planNextPeriod,monthSnapshot} from '../src/operations.ts';
import {createPaymentAudit,encodePaymentAudit,decodePaymentAudit,auditUrl} from '../src/audit.ts';
const address='NQ07 0000 0000 0000 0000 0000 0000 0000 0000';
const first='0123456789abcdef0123456789abcdef';
const second='11111111111111111111111111111111';
const third='22222222222222222222222222222222';
const fourth='33333333333333333333333333333333';
function fixture():Portfolio{
  let p=emptyPortfolio();
  p=addProperty(p,{id:'building1',name:'A Riverside',createdAt:'2026-11-09T00:00:00.000Z'});
  p=addProperty(p,{id:'building2',name:'B Parkside',createdAt:'2026-11-09T00:00:00.000Z'});
  p=addUnit(p,{id:'unit1',propertyId:'building1',label:'Unit A'});
  p=addUnit(p,{id:'unit2',propertyId:'building1',label:'Unit B'});
  p=addUnit(p,{id:'unit3',propertyId:'building2',label:'Unit C'});
  return addCharge(p,{id:first,unitId:'unit1',period:'2026-11',amountLuna:parseNim('2.5'),recipient:address,memo:makeMemo(first),createdAt:'2026-11-09T00:00:00.000Z'});
}
test('nextMonth advances November to December',()=>assert.equal(nextMonth('2026-11'),'2026-12'));
test('nextMonth crosses year boundary',()=>assert.equal(nextMonth('2026-12'),'2027-01'));
test('nextMonth advances January to February',()=>assert.equal(nextMonth('2027-01'),'2027-02'));
test('nextMonth never accepts month zero',()=>assert.throws(()=>nextMonth('2027-00')));
test('nextMonth never accepts 13',()=>assert.throws(()=>nextMonth('2027-13')));
test('nextMonth rejects empty period',()=>assert.throws(()=>nextMonth('')));
test('nextMonth blocks year overflow',()=>assert.throws(()=>nextMonth('9999-12')));
test('monthly snapshot for empty unit portfolio is all zero',()=>{
 const r=monthSnapshot(emptyPortfolio(),'2026-11');assert.equal(r.charges,0);assert.equal(r.activeUnits,0);assert.equal(r.expectedLuna,0);
});
test('snapshot counts unbilled units separately from unpaid charges',()=>{
 const r=monthSnapshot(fixture(),'2026-11');
 assert.equal(r.charges,1);assert.equal(r.activeUnits,3);assert.equal(r.unitsWithoutCharge,2);
 assert.equal(r.expectedLuna,250000);assert.equal(r.outstandingLuna,250000);
});
test('snapshot month without charges still shows units needing a charge',()=>{
 const r=monthSnapshot(fixture(),'2026-12');assert.equal(r.charges,0);assert.equal(r.unitsWithoutCharge,3);
});
test('snapshot filters by building',()=>{
 const r=monthSnapshot(fixture(),'2026-11','building1');
 assert.equal(r.charges,1);assert.equal(r.activeUnits,2);assert.equal(r.unitsWithoutCharge,1);
 assert.equal(r.lines[0].propertyName,'A Riverside');
});
test('snapshot other building does not include first building charges',()=>{
 const r=monthSnapshot(fixture(),'2026-11','building2');
 assert.equal(r.charges,0);assert.equal(r.activeUnits,1);assert.equal(r.unitsWithoutCharge,1);
});
test('snapshot unknown building rejected',()=>assert.throws(()=>monthSnapshot(fixture(),'2026-11','bogus')));
test('snapshot month must be YYYY-MM',()=>assert.throws(()=>monthSnapshot(fixture(),'Nov 2026')));
test('snapshot sums multiple charges in exact integer Luna',()=>{
 let p=fixture();
 p=addCharge(p,{id:second,unitId:'unit2',period:'2026-11',amountLuna:125001,recipient:address,memo:makeMemo(second),createdAt:'2026-11-09T00:00:00.000Z'});
 const r=monthSnapshot(p,'2026-11');assert.equal(r.expectedLuna,375001);assert.equal(r.outstandingLuna,375001);
});
test('snapshot treats submitted as unverified, never as paid',()=>{
 let p=fixture();p=recordSubmission(p,{chargeId:first,hash:'a'.repeat(64),state:'SUBMITTED_UNVERIFIED',createdAt:'2026-11-09T00:00:00.000Z'});
 const r=monthSnapshot(p,'2026-11');assert.equal(r.awaitingProof,1);assert.equal(r.outstandingLuna,250000);
 assert.equal(r.lines[0].status,'SUBMITTED_UNVERIFIED');
});
test('snapshot guards safe integer overflow across charges',()=>{
 let p=fixture();p=addCharge(p,{id:second,unitId:'unit2',period:'2026-11',amountLuna:Number.MAX_SAFE_INTEGER,recipient:address,memo:makeMemo(second),createdAt:'2026-11-09T00:00:00.000Z'});
 assert.throws(()=>monthSnapshot(p,'2026-11'),/safe integer/);
});
test('next-period planning produces independent request ID and memo',()=>{
 const p=fixture();const r=planNextPeriod(p,'2026-11',[second],'2026-11-09T00:00:00.000Z');
 assert.equal(r.generated,1);assert.equal(r.skipped,0);assert.equal(r.newPeriod,'2026-12');
 assert.equal(r.portfolio.charges.length,2);
 const b=r.portfolio.charges[1];assert.equal(b.id,second);assert.equal(b.memo,makeMemo(second));
 assert.equal(b.amountLuna,250000);assert.equal(b.recipient,p.charges[0].recipient);
});
test('next-period planning never mutates original portfolio',()=>{
 const p=fixture();planNextPeriod(p,'2026-11',[second],'2026-11-09T00:00:00.000Z');
 assert.equal(p.charges.length,1);
});
test('next-period planning rejects missing month',()=>assert.throws(()=>planNextPeriod(fixture(),'2026-10',[second],'2026-11-09T00:00:00.000Z')));
test('next-period planning rejects invalid createdAt',()=>assert.throws(()=>planNextPeriod(fixture(),'2026-11',[second],'bad-date')));
test('next-period planning rejects missing random IDs',()=>assert.throws(()=>planNextPeriod(fixture(),'2026-11',[],'2026-11-09T00:00:00.000Z')));
test('next-period planning rejects repeated previous payment reference',()=>assert.throws(()=>planNextPeriod(fixture(),'2026-11',[first],'2026-11-09T00:00:00.000Z')));
test('next-period planning skips charges already in next month',()=>{
 const p=planNextPeriod(fixture(),'2026-11',[second],'2026-11-09T00:00:00.000Z').portfolio;
 assert.throws(()=>planNextPeriod(p,'2026-11',[],'2026-11-09T00:00:00.000Z'),/already have/);
});
test('next-period planning skips only pre-existing and generates rest',()=>{
 let p=fixture();
 p=addCharge(p,{id:second,unitId:'unit2',period:'2026-11',amountLuna:50000,recipient:address,memo:makeMemo(second),createdAt:'2026-11-09T00:00:00.000Z'});
 p=addCharge(p,{id:third,unitId:'unit2',period:'2026-12',amountLuna:50000,recipient:address,memo:makeMemo(third),createdAt:'2026-11-09T00:00:00.000Z'});
 const r=planNextPeriod(p,'2026-11',[fourth],'2026-11-09T00:00:00.000Z');
 assert.equal(r.generated,1);assert.equal(r.skipped,1);
 assert.equal(r.portfolio.charges.length,4);
});
test('next-period planner rejects repeated new random IDs',()=>{
 let p=fixture();p=addCharge(p,{id:second,unitId:'unit2',period:'2026-11',amountLuna:50000,recipient:address,memo:makeMemo(second),createdAt:'2026-11-09T00:00:00.000Z'});
 assert.throws(()=>planNextPeriod(p,'2026-11',[third,third],'2026-11-09T00:00:00.000Z'),/Duplicate/);
});
const request={v:1 as const,chargeId:first,memo:makeMemo(first),recipient:address,amountLuna:250000,period:'2026-11'};
const validHash='a'.repeat(64);
test('public audit payload roundtrip contains only request tuple + hash',()=>{
 const data=createPaymentAudit(request,validHash);
 const decoded=decodePaymentAudit(encodePaymentAudit(data));
 assert.deepEqual(decoded,data);assert.equal('unitLabel' in decoded.request,false);
});
test('audit link can be independently rechecked from another device',()=>{
 const url=auditUrl('https://rentrail.example','/',createPaymentAudit(request,validHash));
 const parsed=new URL(url);const decoded=decodePaymentAudit(parsed.searchParams.get('audit')||'');
 assert.equal(decoded.txHash,validHash);assert.equal(decoded.request.period,'2026-11');
});
test('audit link cannot include a malformed hash',()=>assert.throws(()=>createPaymentAudit(request,'bad')));
test('audit link hash case normalized',()=>assert.equal(createPaymentAudit(request,'A'.repeat(64)).txHash,validHash));
test('audit request cannot have fake memo',()=>assert.throws(()=>createPaymentAudit({...request,memo:'private person name'},validHash)));
test('audit request cannot have unsafe amount',()=>assert.throws(()=>createPaymentAudit({...request,amountLuna:Number.MAX_SAFE_INTEGER+1},validHash)));
test('audit request cannot have unknown network data',()=>assert.throws(()=>createPaymentAudit({...request,v:2 as 1},validHash)));
test('audit link parser rejects oversized input',()=>assert.throws(()=>decodePaymentAudit('a'.repeat(2001))));
test('audit link parser rejects invalid alphabet',()=>assert.throws(()=>decodePaymentAudit('not valid!')));
test('audit link parser rejects invalid JSON',()=>assert.throws(()=>decodePaymentAudit(btoa('not json'))));
test('audit link parser rejects different version',()=>assert.throws(()=>decodePaymentAudit(btoa(JSON.stringify({v:2,request,txHash:validHash})))));
test('audit link parser rejects missing request',()=>assert.throws(()=>decodePaymentAudit(btoa(JSON.stringify({v:1,txHash:validHash})))));
test('audit link parser rejects corrupted public tuple',()=>assert.throws(()=>decodePaymentAudit(btoa(JSON.stringify({v:1,request:{...request,recipient:'invalid'},txHash:validHash})))));
test('audit link encoder rejects invalid version',()=>assert.throws(()=>encodePaymentAudit({...createPaymentAudit(request,validHash),v:2 as 1})));
