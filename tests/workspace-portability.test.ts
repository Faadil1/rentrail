import assert from 'node:assert/strict';
import {test} from 'node:test';
import {addCharge,addProperty,addUnit,emptyPortfolio,makeMemo,recordSubmission,type Portfolio} from '../src/domain.ts';
import {backupSummary,createWorkspaceBackup,readWorkspaceBackup,validateWorkspacePortfolio} from '../src/workspace-portability.ts';
const id='a'.repeat(32), addr='NQ07 0000 0000 0000 0000 0000 0000 0000 0000',date='2026-11-10T00:00:00Z';
function sample():Portfolio{
 let p=emptyPortfolio();p=addProperty(p,{id:'p1',name:'Example complex',createdAt:date});
 p=addUnit(p,{id:'u1',propertyId:'p1',label:'Unit 1'});
 p=addCharge(p,{id,unitId:'u1',period:'2026-11',amountLuna:500,recipient:addr,memo:makeMemo(id),createdAt:date});
 return p;
}
const mutate=(fn:(p:Portfolio)=>void)=>{const raw=JSON.parse(createWorkspaceBackup(sample()));fn(raw.portfolio);return JSON.stringify(raw)};
test('roundtrip portable workspace preserves unit and specific monthly charge',()=>{
 const r=readWorkspaceBackup(createWorkspaceBackup(sample(),date));
 assert.equal(r.format,'rentrail-workspace');assert.equal(r.exportedAt,date);
 assert.equal(r.portfolio.charges[0].memo,makeMemo(id));assert.deepEqual(backupSummary(r.portfolio),{properties:1,units:1,charges:1,unverified:0});
});
test('empty portfolio is valid and roundtrips',()=>assert.equal(readWorkspaceBackup(createWorkspaceBackup(emptyPortfolio())).portfolio.charges.length,0));
test('unverified hash stays unverified after backup, never paid',()=>{
 const p=recordSubmission(sample(),{chargeId:id,hash:'f'.repeat(64),state:'SUBMITTED_UNVERIFIED',createdAt:date});
 const result=readWorkspaceBackup(createWorkspaceBackup(p));
 assert.equal(result.portfolio.submissions[0].state,'SUBMITTED_UNVERIFIED');
 assert.equal(backupSummary(result.portfolio).unverified,1);
});
test('unknown outcome remains unknown',()=>{
 const p=recordSubmission(sample(),{chargeId:id,hash:null,state:'OUTCOME_UNKNOWN',createdAt:date});
 assert.equal(readWorkspaceBackup(createWorkspaceBackup(p)).portfolio.submissions[0].state,'OUTCOME_UNKNOWN');
});
test('corrupt input does not destroy existing workspace',()=>assert.throws(()=>readWorkspaceBackup('{broken'),/rejected/));
test('non-backup JSON fails',()=>assert.throws(()=>readWorkspaceBackup(JSON.stringify({foo:'bar'})),/rejected/));
test('backup capped at 200k',()=>assert.throws(()=>readWorkspaceBackup('a'.repeat(200001)),/oversized/));
test('unknown version blocked',()=>{const x=JSON.parse(createWorkspaceBackup(sample()));x.version=2;assert.throws(()=>readWorkspaceBackup(JSON.stringify(x)))});
test('unknown schema blocked',()=>assert.throws(()=>readWorkspaceBackup(mutate(p=>{p.schemaVersion=2 as 1}))));
test('missing unit linkage blocked',()=>assert.throws(()=>readWorkspaceBackup(mutate(p=>{p.units[0].propertyId='bad'}))));
test('missing charge linkage blocked',()=>assert.throws(()=>readWorkspaceBackup(mutate(p=>{p.charges[0].unitId='bad'}))));
test('duplicate units blocked',()=>assert.throws(()=>readWorkspaceBackup(mutate(p=>{p.units.push({...p.units[0]})}))));
test('duplicate charge ID blocked',()=>assert.throws(()=>readWorkspaceBackup(mutate(p=>{p.charges.push({...p.charges[0]})}))));
test('bad memo blocked',()=>assert.throws(()=>readWorkspaceBackup(mutate(p=>{p.charges[0].memo='tenant phone number'}))));
test('invalid recipient blocked',()=>assert.throws(()=>readWorkspaceBackup(mutate(p=>{p.charges[0].recipient='not an NQ address'}))));
test('zero Luna blocked',()=>assert.throws(()=>readWorkspaceBackup(mutate(p=>{p.charges[0].amountLuna=0}))));
test('negative Luna blocked',()=>assert.throws(()=>readWorkspaceBackup(mutate(p=>{p.charges[0].amountLuna=-1}))));
test('invalid property name blocked',()=>assert.throws(()=>readWorkspaceBackup(mutate(p=>{p.properties[0].name='\n<script>'}))));
test('unknown payment status blocked',()=>{const p=recordSubmission(sample(),{chargeId:id,hash:'f'.repeat(64),state:'SUBMITTED_UNVERIFIED',createdAt:date});const x=JSON.parse(createWorkspaceBackup(p));x.portfolio.submissions[0].state='PAID';assert.throws(()=>readWorkspaceBackup(JSON.stringify(x)))});
test('unlinked payment claim blocked',()=>{const p=recordSubmission(sample(),{chargeId:id,hash:'f'.repeat(64),state:'SUBMITTED_UNVERIFIED',createdAt:date});const x=JSON.parse(createWorkspaceBackup(p));x.portfolio.submissions[0].chargeId='unknown';assert.throws(()=>readWorkspaceBackup(JSON.stringify(x)))});
test('malformed hash blocked',()=>{const p=recordSubmission(sample(),{chargeId:id,hash:'f'.repeat(64),state:'SUBMITTED_UNVERIFIED',createdAt:date});const x=JSON.parse(createWorkspaceBackup(p));x.portfolio.submissions[0].hash='zzz';assert.throws(()=>readWorkspaceBackup(JSON.stringify(x)))});
test('too many properties blocked',()=>assert.throws(()=>validateWorkspacePortfolio({...sample(),properties:Array(101).fill(sample().properties[0])})));
test('original data remains unchanged on validation',()=>{const p=sample();validateWorkspacePortfolio(p);assert.equal(p.charges[0].recipient,addr)});
