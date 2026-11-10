import assert from 'node:assert/strict';
import {test} from 'node:test';
import { inspectWalletAddresses, receivingAddressAssessment, MAX_SHARED_ACCOUNTS, type WalletReadProvider } from '../src/wallet-preflight.ts';

const a='NQ07 0000 0000 0000 0000 0000 0000 0000 0000';
const b='NQ01 1111 1111 1111 1111 1111 1111 1111 1111';
function provider(addresses:string[]=[a],balances:Record<string,number>={}):WalletReadProvider{
 return {async listAccounts(){return addresses;},async getBalance(address){return Object.hasOwn(balances,address)?balances[address]:100_000;}};
}
test('explicit read-only request receives address and one NIM balance in Luna',async()=>{
 const x=await inspectWalletAddresses(provider([a],{[a]:100_000}),'mainnet',1794271800000);
 assert.equal(x.accounts.length,1);assert.equal(x.accounts[0].balanceLuna,100_000);
 assert.equal(x.senderIdentified,false);assert.equal(x.network,'mainnet');assert.equal(x.warnings.length,0);
});
test('TESTNET host cannot masquerade as MAINNET',async()=>{
 let called=false;await assert.rejects(()=>inspectWalletAddresses({async listAccounts(){called=true;return []}},'testnet'));
 assert.equal(called,false);
});
test('unknown host network cannot inspect for mainnet gate',async()=>assert.rejects(()=>inspectWalletAddresses(provider(),'unknown')));
test('wallet permission rejection propagates and no balances are read',async()=>{
 await assert.rejects(()=>inspectWalletAddresses({async listAccounts(){throw Error('permission denied')}},'mainnet'),/permission denied/);
});
test('empty shared list is not a selected sender',async()=>{
 const x=await inspectWalletAddresses(provider([]),'mainnet');
 assert.equal(x.accounts.length,0);assert.equal(x.senderIdentified,false);assert.match(x.warnings.join(' '),/No Nimiq/);
});
test('read-only balance lookup absence is unknown, not zero',async()=>{
 const x=await inspectWalletAddresses({async listAccounts(){return [a]}},'mainnet');
 assert.equal(x.accounts[0].balanceLuna,null);assert.match(x.warnings.join(' '),/getBalance/);
});
test('balance lookup failures do not report a false 0',async()=>{
 const x=await inspectWalletAddresses({async listAccounts(){return [a]},async getBalance(){throw Error('offline')}},'mainnet');
 assert.equal(x.accounts[0].balanceLuna,null);assert.match(x.warnings.join(' '),/failed/);
});
test('valid zero balance is distinguishable from failed read',async()=>{
 const x=await inspectWalletAddresses(provider([a],{[a]:0}),'mainnet');
 assert.equal(x.accounts[0].balanceLuna,0);
});
test('unsafe balance number becomes unknown',async()=>{
 const x=await inspectWalletAddresses(provider([a],{[a]:Number.MAX_SAFE_INTEGER+1}),'mainnet');
 assert.equal(x.accounts[0].balanceLuna,null);
});
test('invalid address shape fails closed',async()=>assert.rejects(()=>inspectWalletAddresses(provider(['bad']),'mainnet'),/Unexpected/));
test('nonarray shared response fails closed',async()=>assert.rejects(()=>inspectWalletAddresses({async listAccounts(){return null as unknown as string[]}},'mainnet')));
test('too many shared addresses fail before any balance read',async()=>{
 const addresses=Array(MAX_SHARED_ACCOUNTS+1).fill(a);let called=false;
 await assert.rejects(()=>inspectWalletAddresses({async listAccounts(){return addresses},async getBalance(){called=true;return 0}},'mainnet'));
 assert.equal(called,false);
});
test('duplicate addresses fail closed',async()=>assert.rejects(()=>inspectWalletAddresses(provider([a,a]),'mainnet'),/Duplicate/));
test('recipient matching an exposed wallet account triggers self-send warning',async()=>{
 const x=await inspectWalletAddresses(provider([a]),'mainnet');
 const result=receivingAddressAssessment(x,a);
 assert.equal(result.recipientAppearsInWallet,true);assert.equal(result.mayProceedToHumanReview,false);
 assert.match(result.message,/self-transfer/);
});
test('same address with different spacing still counts as self-transfer risk',async()=>{
 const x=await inspectWalletAddresses(provider([a]),'mainnet');
 assert.equal(receivingAddressAssessment(x,a.replaceAll(' ','')).mayProceedToHumanReview,false);
});
test('other receiving address avoids only the self-send-list check',async()=>{
 const x=await inspectWalletAddresses(provider([a]),'mainnet');
 const result=receivingAddressAssessment(x,b);
 assert.equal(result.recipientAppearsInWallet,false);assert.equal(result.mayProceedToHumanReview,true);
 assert.match(result.message,/does NOT prove/);
});
test('receiver of unknown structure blocked',async()=>{
 const x=await inspectWalletAddresses(provider([a]),'mainnet');
 assert.equal(receivingAddressAssessment(x,'bad').mayProceedToHumanReview,false);
});
test('no send method or seed phrase is ever required by the inspector',async()=>{
 const requested:string[]=[];
 const x=await inspectWalletAddresses({
   async listAccounts(){requested.push('listAccounts');return [a]},
   async getBalance(){requested.push('getBalance');return 50_000}
 },'mainnet');
 assert.deepEqual(requested,['listAccounts','getBalance']);assert.equal(x.accounts[0].balanceLuna,50_000);
});
