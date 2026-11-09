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
 console.log(JSON.stringify(out,null,2));
}catch(error){console.error('G3 RPC probe NOT_VERIFIED:',error?.message||String(error));process.exitCode=1;}