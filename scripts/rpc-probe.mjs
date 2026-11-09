// Read-only RPC network probe: prints only public block metadata, never signs or broadcasts.
const endpoint = 'https://rpc.nimiqwatch.com/';
let id=0;
async function rpc(method,params){
  const current=++id;
  const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:current,method,params}),signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw Error(method+' HTTP '+response.status);
  const obj=await response.json();
  if(obj.id!==current||obj.error||!obj.result||!Object.prototype.hasOwnProperty.call(obj.result,'data'))throw Error('Unexpected RPC response: '+method+' '+JSON.stringify(obj).slice(0,350));
  return obj.result.data;
}
try{
 const cons=await rpc('isConsensusEstablished',[]);
 const head=await rpc('getLatestBlock',[false]);
 const height=await rpc('getBlockNumber',[]);
 if(!head||typeof head!=='object'||!Number.isInteger(head.number))throw Error('Bad head shape');
 const probeAt=Math.max(1,head.number-120);
 const next=await rpc('getMacroBlockAfter',[probeAt]);
 const macro=Number.isInteger(next)?await rpc('getBlockByNumber',[next,false]):null;
 const out={
  observedAt:new Date().toISOString(),endpoint,consensus:cons,headHeight:height,
  head:{keys:Object.keys(head),number:head.number,network:head.network,type:head.type,timestamp:head.timestamp,hash:head.hash},
  probeFrom:probeAt,macroHeight:next,
  macro:macro&&typeof macro==='object'?{keys:Object.keys(macro),number:macro.number,type:macro.type,network:macro.network,hash:macro.hash}:macro
 };
 // Browser/CORS visibility: a successful server fetch does NOT prove the iPhone WebView can call RPC.
 try {
   const opt=await fetch(endpoint,{method:'OPTIONS',headers:{
     'Origin':'https://rentrail-g1-preview-786i72h9q-faadil1s-projects.vercel.app',
     'Access-Control-Request-Method':'POST',
     'Access-Control-Request-Headers':'content-type',
   },signal:AbortSignal.timeout(6000)});
   out.cors={status:opt.status,allowOrigin:opt.headers.get('access-control-allow-origin'),
     allowHeaders:opt.headers.get('access-control-allow-headers'),
     allowMethods:opt.headers.get('access-control-allow-methods')};
 } catch(error){out.cors={state:'NOT_OBSERVED',reason:error?.message||String(error)};}
 // Check a real PUBLIC transaction's field SHAPE only; never credit it to a rental charge.
 let sample=null;
 for(const offset of [2,5,10,15,20,25,30,35,40,45]){
   try{
     const txs=await rpc('getTransactionsByBlockNumber',[Math.max(1,head.number-offset)]);
     if(!Array.isArray(txs)||!txs.length)continue;
     const first=txs.find(x=>x&&typeof x==='object'&&/^[a-f0-9]{64}$/i.test(x.hash||''));
     if(!first)continue;
     const tx=await rpc('getTransactionByHash',[first.hash]);
     if(!tx||typeof tx!=='object')continue;
     sample={blockRequested:head.number-offset,listCount:txs.length,keys:Object.keys(tx),
       hashPresent:typeof tx.hash==='string',blockNumber:tx.blockNumber,
       networkId:tx.networkId,executionResult:tx.executionResult,
       recipientDataType:typeof tx.recipientData,
       recipientDataHexLike:typeof tx.recipientData==='string'&&/^[0-9a-f]*$/i.test(tx.recipientData),
       valueType:typeof tx.value};
     break;
   }catch(error){sample={state:'NOT_OBSERVED',reason:error?.message||String(error)};break;}
 }
 out.publicTransactionShape=sample||{state:'NOT_OBSERVED',reason:'No transactions observed in limited read-only sample'};
 console.log(JSON.stringify(out,null,2));
}catch(error){console.error('G3 RPC probe NOT_VERIFIED:',error?.message||String(error));process.exitCode=1;}