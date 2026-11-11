import assert from 'node:assert/strict';
import {test} from 'node:test';
import {parseSavedHashes,addSavedHash,removeSavedHash,MAX_SAVED_HASHES} from '../src/saved-hash-review.ts';
const charge='a'.repeat(32), other='b'.repeat(32),hash='e'.repeat(64);
const known=new Set([charge,other]),entry={chargeId:charge,hash,addedAt:'2026-11-10T00:00:00.000Z'};
test('local hash references do not include verified or settled status',()=>{
 const refs=addSavedHash([],entry,known);
 assert.deepEqual(refs,[entry]);
 assert.equal(JSON.stringify(refs).includes('FINAL_MATCHED'),false);
});
test('casebook survives JSON roundtrip as untrusted references only',()=>{
 const refs=parseSavedHashes(JSON.stringify([entry]),known);
 assert.equal(refs[0].hash,hash);
 assert.equal(refs[0].chargeId,charge);
});
test('same hash can only be linked to one rental request',()=>{
 assert.throws(()=>addSavedHash([entry],{...entry,chargeId:other},known),/another/);
});
test('saving the same hash twice is idempotent',()=>{
 assert.equal(addSavedHash([entry],entry,known).length,1);
});
test('reject forged stored finality and malformed dates',()=>{
 assert.deepEqual(parseSavedHashes(JSON.stringify([{...entry,addedAt:'invalid'}]),known),[]);
 assert.deepEqual(parseSavedHashes(JSON.stringify([{...entry,hash:'fake'}]),known),[]);
 assert.deepEqual(parseSavedHashes(JSON.stringify([{...entry,chargeId:'c'.repeat(32)}]),known),[]);
});
test('repeated hash across different charges fails closed',()=>{
 assert.deepEqual(parseSavedHashes(JSON.stringify([entry,{...entry,chargeId:other}]),known),[]);
});
test('local collection reference list has an explicit cap',()=>{
 const refs=Array.from({length:MAX_SAVED_HASHES},(_,i)=>({...entry,hash:i.toString(16).repeat(64)}));
 assert.throws(()=>addSavedHash(refs,{...entry,hash:'f'.repeat(64)},known),/full/);
 assert.deepEqual(parseSavedHashes(JSON.stringify([...refs,entry]),known),[]);
});
test('remove is exact, does not affect other references',()=>{
 const second={...entry,hash:'f'.repeat(64)};
 assert.deepEqual(removeSavedHash([entry,second],hash),[second]);
});
