// Read-only probe: does the public history node serve getTransactionsByAddress?
const endpoint='https://rpc.nimiqwatch.com/';let id=0;
async function rpc(method,params){const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:++id,method,params}),signal:AbortSignal.timeout(15000)});return r.json();}
const head=(await rpc('getLatestBlock',[false])).result.data;
let addr=null;
for(let b=head.number-1;b>head.number-400&&!addr;b--){const t=await rpc('getTransactionsByBlockNumber',[b]);const list=t?.result?.data;if(Array.isArray(list)&&list.length){addr=list[0].to;console.log('sample block',b,'keys',Object.keys(list[0]).join(','));}}
console.log('address',addr);
for(const [m,p] of [['getTransactionsByAddress',[addr,3]],['getTransactionHashesByAddress',[addr,3]],['getTransactionsByAddress',[addr,3,null]]]){
  const r=await rpc(m,p);console.log(m,JSON.stringify(p).length,'=>',JSON.stringify(r).slice(0,700));
}
