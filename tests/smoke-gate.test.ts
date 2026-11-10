import assert from 'node:assert/strict';
import {test} from 'node:test';
import {assessSmokePayment,SMOKE_MAX_LUNA,MAX_BLOCK_HEIGHT_DRIFT,MAX_RPC_AGE_MS,type SmokeContext} from '../src/smoke-gate.ts';
const now=Date.UTC(2026,10,9,20,0,0);
function ready(overrides:Partial<SmokeContext>={}):SmokeContext{
 return {buildAllowsSmoke:true,walletNetwork:'mainnet',consensus:true,walletBlockHeight:66452000,hostCheckedAtMs:now-2_000,
 publicRpcNetwork:'MainAlbatross',publicRpcBlockHeight:66452001,
 publicRpcObservedAt:new Date(now-2_000).toISOString(),nowMs:now,
 amountLuna:500,recipientCheckAcknowledged:true,realMoneyAcknowledged:true,
 walletApprovalAcknowledged:true,priorAttemptUnresolved:false,
 recipient:'NQ07 0000 0000 0000 0000 0000 0000 0000 0000',
 memo:'RR1:0123456789abcdef0123456789abcdef',...overrides};
}
const rejected=(overrides:Partial<SmokeContext>)=>assert.equal(assessSmokePayment(ready(overrides)).allowed,false);
test('fully evidenced and consented smoke path can be offered (not executed)',()=>{
 const x=assessSmokePayment(ready());assert.equal(x.allowed,true);assert.deepEqual(x.reasons,[]);
});
test('public build flag denies every transfer',()=>rejected({buildAllowsSmoke:false}));
test('SDK does not return a usable network',()=>rejected({walletNetwork:'unknown'}));
test('host TESTNET cannot trigger mainnet payment',()=>rejected({walletNetwork:'testnet'}));
test('absent consensus denies',()=>rejected({consensus:false}));
test('missing SDK block height denies',()=>rejected({walletBlockHeight:null}));
test('old host network observation is rejected',()=>rejected({hostCheckedAtMs:now-MAX_RPC_AGE_MS-1}));
test('host observation absent is rejected',()=>rejected({hostCheckedAtMs:null}));
test('missing independent RPC block height denies',()=>rejected({publicRpcBlockHeight:null}));
test('wrong RPC chain denies',()=>rejected({publicRpcNetwork:'TestAlbatross'}));
test('unverified RPC network denies',()=>rejected({publicRpcNetwork:null}));
test('stale read denies',()=>rejected({publicRpcObservedAt:new Date(now-MAX_RPC_AGE_MS-1).toISOString()}));
test('future read denies',()=>rejected({publicRpcObservedAt:new Date(now+10_001).toISOString()}));
test('malformed RPC timestamp denies',()=>rejected({publicRpcObservedAt:'not-a-date'}));
test('block height disagreement denies',()=>rejected({walletBlockHeight:66452000-MAX_BLOCK_HEIGHT_DRIFT-2}));
test('exact drift boundary is allowed',()=>assert.equal(assessSmokePayment(ready({walletBlockHeight:66452001-MAX_BLOCK_HEIGHT_DRIFT})).allowed,true));
test('zero transfer amount denies',()=>rejected({amountLuna:0}));
test('negative transfer amount denies',()=>rejected({amountLuna:-1}));
test('amount over 0.01 NIM denies',()=>rejected({amountLuna:SMOKE_MAX_LUNA+1}));
test('exact 0.01 NIM passes if all other controls pass',()=>assert.equal(assessSmokePayment(ready({amountLuna:SMOKE_MAX_LUNA})).allowed,true));
test('invalid public reference denies',()=>rejected({memo:'nov rent Unit 23'}));
test('invalid recipient denies',()=>rejected({recipient:'hacker'}));
test('recipient not independently confirmed denies',()=>rejected({recipientCheckAcknowledged:false}));
test('real money not acknowledged denies',()=>rejected({realMoneyAcknowledged:false}));
test('wallet native confirmation not acknowledged denies',()=>rejected({walletApprovalAcknowledged:false}));
test('unresolved prior attempt denies',()=>rejected({priorAttemptUnresolved:true}));
test('no wallet-only consensus fallback',()=>rejected({publicRpcObservedAt:null}));
test('missing build recipient allowlist prevents sending',()=>rejected({allowlistedRecipient:null}));
test('recipient that differs from allowlist prevents sending',()=>rejected({allowlistedRecipient:'NQ01 1111 1111 1111 1111 1111 1111 1111 1111'}));
test('allowlist compares normalized addresses',()=>assert.equal(assessSmokePayment(ready({allowlistedRecipient:'nq0700000000000000000000000000000000'})).allowed,true));
