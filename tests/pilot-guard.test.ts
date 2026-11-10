import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkPilotRequest,PILOT_LUNA,PILOT_PERIOD, type PilotConfig } from '../src/pilot-guard.ts';
import type { SharedRequest } from '../src/domain.ts';

const VALID_A='NQ07 0000 0000 0000 0000 0000 0000 0000 0000';
const VALID_OTHER='NQ48 8CKH BA24 2VR3 N249 N8MN J5XX 74DB 5XJ8'; // published example, not user wallet
const ID='62b40b301f8829c113e7e5a622840450';
const request:SharedRequest={v:1,chargeId:ID,recipient:VALID_A,amountLuna:500,memo:`RR1:${ID}`,period:'2026-11'};
const config:PilotConfig={recipient:VALID_A,chargeId:ID,amountLuna:'500',period:'2026-11'};
const deny=(r:SharedRequest=request,c:PilotConfig=config)=>assert.equal(checkPilotRequest(r,c).allowed,false);
test('exact recipient, amount, reference and month can pass pure pilot preflight (no funds sent)',()=>{
 const p=checkPilotRequest(request,config);assert.equal(p.allowed,true);assert.deepEqual(p.reasons,[]);
 assert.equal(PILOT_LUNA,500);assert.equal(PILOT_PERIOD,'2026-11');
});
test('empty recipient build config fails closed',()=>deny(request,{...config,recipient:undefined}));
test('wrong valid recipient build config fails closed',()=>deny(request,{...config,recipient:VALID_OTHER}));
test('recipient changed in user-edited URL fails closed',()=>deny({...request,recipient:VALID_OTHER}));
test('recipient bad checksum fails closed',()=>deny(request,{...config,recipient:'NQ01 1111 1111 1111 1111 1111 1111 1111 1111'}));
test('amount cannot be 0 Luna',()=>deny({...request,amountLuna:0}));
test('amount cannot be 499 Luna',()=>deny({...request,amountLuna:499}));
test('amount cannot be 501 Luna',()=>deny({...request,amountLuna:501}));
test('amount cannot be normal rent amount',()=>deny({...request,amountLuna:100_000}));
test('amount env must explicitly say 500',()=>deny(request,{...config,amountLuna:undefined}));
test('amount env must not be 1000',()=>deny(request,{...config,amountLuna:'1000'}));
test('amount env must not be 500.0',()=>deny(request,{...config,amountLuna:'500.0'}));
test('period cannot be changed in link',()=>deny({...request,period:'2026-12'}));
test('period cannot be changed in config',()=>deny(request,{...config,period:'2026-12'}));
test('period cannot be missing from config',()=>deny(request,{...config,period:undefined}));
test('reference cannot be changed in link',()=>deny({...request,chargeId:'a'.repeat(32),memo:'RR1:'+'a'.repeat(32)}));
test('memo cannot be changed',()=>deny({...request,memo:'RR1:'+'a'.repeat(32)}));
test('reference cannot be missing from config',()=>deny(request,{...config,chargeId:undefined}));
test('reference cannot be malformed in config',()=>deny(request,{...config,chargeId:'not-a-hash'}));
test('reference must match exact build allowlist',()=>deny(request,{...config,chargeId:'f'.repeat(32)}));
test('normalized NQ case and whitespace are accepted if checksum valid',()=>{
 const c={...config,recipient:VALID_A.replaceAll(' ','').toLowerCase()};
 assert.equal(checkPilotRequest({...request,recipient:VALID_A.toLowerCase()},c).allowed,true);
});
