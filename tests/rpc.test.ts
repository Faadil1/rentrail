import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createReadOnlyRpc,decodeRecipientData,verifyNimTransaction,
  PUBLIC_RPC, type RpcReader, type ReadMethod, type VerifyInput} from '../src/rpc.ts';

const t=1794236120000;
const id='0123456789abcdef0123456789abcdef';
const memo='RR1:'+id;
const hash='a'.repeat(64);
const recipient='NQ07 0000 0000 0000 0000 0000 0000 0000 0000';
const otherRecipient='NQ01 1111 1111 1111 1111 1111 1111 1111 1111';
const hex=(v:string)=>Array.from(new TextEncoder().encode(v)).map(x=>x.toString(16).padStart(2,'0')).join('');
const input:VerifyInput={hash,recipient,memo,amountLuna:250000};
const baseTx={
 hash, networkId:24, executionResult:true, to:recipient, recipientData:hex(memo),value:250000,
 blockNumber:66449900,from:otherRecipient,
};
type Values={consensus?:unknown;head?:unknown;tx?:unknown;block?:unknown;txList?:unknown;macroAt?:unknown;macroBlock?:unknown;fail?:string};
const value=(overrides: Values={}): RpcReader => async (method:ReadMethod)=>{
 if(overrides.fail===method)throw Error('network outage');
 switch(method) {
  case 'isConsensusEstablished':return Object.hasOwn(overrides,'consensus')?overrides.consensus:true;
  case 'getLatestBlock':return Object.hasOwn(overrides,'head')?overrides.head:
    {number:66450036,network:'MainAlbatross',type:'micro',timestamp:t-2000,hash:'b'.repeat(64)};
  case 'getTransactionByHash':return Object.hasOwn(overrides,'tx')?overrides.tx:baseTx;
  case 'getBlockByNumber':return Object.hasOwn(overrides,'block')?overrides.block:
    {number:66449900,type:'micro',network:'MainAlbatross',hash:'c'.repeat(64)};
  case 'getTransactionsByBlockNumber':return Object.hasOwn(overrides,'txList')?overrides.txList:[{hash}];
  case 'getMacroBlockAfter':return Object.hasOwn(overrides,'macroAt')?overrides.macroAt:66449940;
 }
};
function rpc(overrides:Values={}):RpcReader{
 return async (method,params)=>{
  if(method==='getBlockByNumber' && params[0]===66449940)
    return Object.hasOwn(overrides,'macroBlock')?overrides.macroBlock:
     {number:66449940,type:'macro',network:'MainAlbatross',hash:'d'.repeat(64)};
  return value(overrides)(method,params);
 };
}
const verify=(o:Values={},i:VerifyInput=input)=>verifyNimTransaction(i,rpc(o),t);
test('exact final NIM mainnet tuple is matched, using only one public RPC claim',async()=>{
 const r=await verify();
 assert.equal(r.state,'FINAL_MATCHED');assert.equal(r.network,'MainAlbatross');
 assert.equal(r.blockHeight,66449900);assert.equal(r.macroHeight,66449940);
 assert.equal(r.evidenceSource,'single-public-rpc');assert.match(r.message,/NOT a legally settled/);
});
test('partial payment within charge can be explicitly allowed',async()=>{
 const r=await verify({tx:{...baseTx,value:125000}},{...input,allowPartial:true});
 assert.equal(r.state,'FINAL_MATCHED');assert.equal(r.amountLuna,125000);
});
test('partial payment is rejected by default',async()=>{
 assert.equal((await verify({tx:{...baseTx,value:125000}})).state,'REVIEW_REQUIRED');
});
test('overpayment rejected even when partial payments allowed',async()=>{
 assert.equal((await verify({tx:{...baseTx,value:250001}},{...input,allowPartial:true})).state,'REVIEW_REQUIRED');
});
test('zero amount rejected',async()=>assert.equal((await verify({tx:{...baseTx,value:0}})).state,'REVIEW_REQUIRED'));
test('unsafe amount rejected',async()=>assert.equal((await verify({tx:{...baseTx,value:9007199254740992}})).state,'REVIEW_REQUIRED'));
test('string exact amount accepted as safe integer',async()=>assert.equal((await verify({tx:{...baseTx,value:'250000'}})).state,'FINAL_MATCHED'));
test('malformed amount string rejected',async()=>assert.equal((await verify({tx:{...baseTx,value:'250000.0'}})).state,'REVIEW_REQUIRED'));
test('wrong recipient is rejected',async()=>assert.equal((await verify({tx:{...baseTx,to:otherRecipient}})).state,'REVIEW_REQUIRED'));
test('wrong memo is rejected',async()=>assert.equal((await verify({tx:{...baseTx,recipientData:hex('WRONG')}})).state,'REVIEW_REQUIRED'));
test('missing memo is rejected',async()=>assert.equal((await verify({tx:{...baseTx,recipientData:undefined}})).state,'REVIEW_REQUIRED'));
test('malformed hex memo rejected',async()=>assert.equal((await verify({tx:{...baseTx,recipientData:'0xx'}})).state,'REVIEW_REQUIRED'));
test('network ID must explicitly equal 24',async()=>assert.equal((await verify({tx:{...baseTx,networkId:5}})).state,'REVIEW_REQUIRED'));
test('missing transaction executionResult must not pass',async()=>assert.equal((await verify({tx:{...baseTx,executionResult:undefined}})).state,'REVIEW_REQUIRED'));
test('failed execution cannot count as rent',async()=>assert.equal((await verify({tx:{...baseTx,executionResult:false}})).state,'REVIEW_REQUIRED'));
test('wrong transaction hash cannot pass',async()=>assert.equal((await verify({tx:{...baseTx,hash:'b'.repeat(64)}})).state,'REVIEW_REQUIRED'));
test('transaction absent from history is NOT_FOUND',async()=>assert.equal((await verify({tx:null})).state,'NOT_FOUND'));
test('missing transaction block height is unknown',async()=>assert.equal((await verify({tx:{...baseTx,blockNumber:undefined}})).state,'UNKNOWN'));
test('wrong chain in latest block is unknown, not verified',async()=>assert.equal((await verify({head:{number:66450036,network:'TestAlbatross',timestamp:t-2000}})).state,'UNKNOWN'));
test('stale head cannot pass',async()=>assert.equal((await verify({head:{number:66450036,network:'MainAlbatross',timestamp:t-700000}})).state,'UNKNOWN'));
test('future timestamp cannot pass',async()=>assert.equal((await verify({head:{number:66450036,network:'MainAlbatross',timestamp:t+130000}})).state,'UNKNOWN'));
test('node without consensus cannot pass',async()=>assert.equal((await verify({consensus:false})).state,'UNKNOWN'));
test('wrong microblock type rejected',async()=>assert.equal((await verify({block:{number:66449900,type:'macro',network:'MainAlbatross',hash:'c'.repeat(64)}})).state,'UNKNOWN'));
test('wrong canonical block number rejected',async()=>assert.equal((await verify({block:{number:66449899,type:'micro',network:'MainAlbatross',hash:'c'.repeat(64)}})).state,'UNKNOWN'));
test('transaction missing from canonical block list is not proof',async()=>assert.equal((await verify({txList:[]})).state,'UNKNOWN'));
test('missing canonical tx list is not proof',async()=>assert.equal((await verify({txList:null})).state,'UNKNOWN'));
test('next macroblock in future produces INCLUDED_NOT_FINAL',async()=>{
 const r=await verify({head:{number:66449920,network:'MainAlbatross',timestamp:t-2000}});
 assert.equal(r.state,'INCLUDED_NOT_FINAL');assert.equal(r.macroHeight,66449940);
});
test('macro block missing even after height passed remains UNKNOWN',async()=>assert.equal((await verify({macroBlock:null})).state,'UNKNOWN'));
test('macro block wrong network remains UNKNOWN',async()=>assert.equal((await verify({macroBlock:{number:66449940,type:'macro',network:'TestAlbatross',hash:'d'.repeat(64)}})).state,'UNKNOWN'));
test('macro block wrong type remains UNKNOWN',async()=>assert.equal((await verify({macroBlock:{number:66449940,type:'micro',network:'MainAlbatross',hash:'d'.repeat(64)}})).state,'UNKNOWN'));
test('inconsistent macro height remains UNKNOWN',async()=>assert.equal((await verify({macroAt:66449800})).state,'UNKNOWN'));
test('RPC failure must not credit rent',async()=>assert.equal((await verify({fail:'getTransactionByHash'})).state,'UNKNOWN'));
test('invalid input does not make any calls',async()=>{
 let called=false;
 const result=await verifyNimTransaction({...input,hash:'bad'},async()=>{called=true;throw Error('should not call');},t);
 assert.equal(called,false);assert.equal(result.state,'REVIEW_REQUIRED');
});
test('only exact opaque reference can be used',async()=>assert.equal((await verify({}, {...input,memo:'Unit A1 December'})).state,'REVIEW_REQUIRED'));
test('correct hex-encoded UTF-8 memo decoded',()=>assert.equal(decodeRecipientData('0x'+hex(memo)),memo));
test('invalid UTF-8 cannot be matched',()=>assert.equal(decodeRecipientData('ff'),null));
test('over-length public payload cannot be matched',()=>assert.equal(decodeRecipientData('41'.repeat(65)),null));
test('empty recipientData is distinguishable from missing',()=>{
 assert.equal(decodeRecipientData(''),'');assert.equal(decodeRecipientData(undefined),null);
});
test('RPC method allowlist blocks sendRawTransaction, without network call',async()=>{
 let called=false;
 const call=createReadOnlyRpc((async()=>{called=true;throw Error('should not send')}) as typeof fetch);
 await assert.rejects(()=>call('sendRawTransaction' as ReadMethod,[]),/not read-only/);
 assert.equal(called,false);
});
test('RPC validates strict PoS result.data, never accepts old envelope',async()=>{
 const call=createReadOnlyRpc((async()=>new Response(JSON.stringify({jsonrpc:'2.0',id:1,result:true}),{status:200,headers:{'Content-Type':'application/json'}})) as typeof fetch);
 await assert.rejects(()=>call('isConsensusEstablished',[]),/Unexpected PoS/);
});
test('RPC rejects response with wrong JSON-RPC id',async()=>{
 const call=createReadOnlyRpc((async()=>new Response(JSON.stringify({jsonrpc:'2.0',id:999,result:{data:true,metadata:null}}),{status:200,headers:{'Content-Type':'application/json'}})) as typeof fetch);
 await assert.rejects(()=>call('isConsensusEstablished',[]),/Unexpected PoS/);
});
test('RPC fails closed on 429',async()=>{
 const call=createReadOnlyRpc((async()=>new Response('',{status:429})) as typeof fetch);
 await assert.rejects(()=>call('getLatestBlock',[false]),/HTTP 429/);
});
test('RPC uses pinned HTTPS endpoint, no credentials and read-only POST',async()=>{
 let request:RequestInit|undefined;
 const call=createReadOnlyRpc((async(url:RequestInfo|URL,options?:RequestInit)=>{
  assert.equal(url,PUBLIC_RPC);request=options;
  return new Response(JSON.stringify({jsonrpc:'2.0',id:1,result:{data:true,metadata:null}}),{status:200});
 }) as typeof fetch);
 assert.equal(await call('isConsensusEstablished',[]),true);
 assert.equal(request?.method,'POST');assert.equal(request?.credentials,'omit');assert.equal(request?.redirect,'error');
 const parsed=JSON.parse(String(request?.body));assert.deepEqual(parsed.params,[]);assert.equal(parsed.method,'isConsensusEstablished');
});
