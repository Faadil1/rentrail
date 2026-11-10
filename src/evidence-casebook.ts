import {type Portfolio} from './domain.ts';
import {type VerifyResult} from './rpc.ts';

export interface ObservedPayment {
  chargeId:string;
  hash:string;
  amountLuna:number;
  observedAt:string;
  rpcUrl:string;
  network:'MainAlbatross';
  blockHeight:number;
  macroHeight:number;
  source:'single-public-rpc';
}
export interface PaymentCasebook { version:1; entries:ObservedPayment[] }
export const CASEBOOK_KEY='rentrail-observed-chain-evidence-v1';
const hashOk=(x:unknown):x is string=>typeof x==='string'&&/^[0-9a-f]{64}$/i.test(x);
const stampOk=(x:unknown):x is string=>typeof x==='string'&&x.length<=40&&Number.isFinite(Date.parse(x));
const positive=(n:unknown):n is number=>typeof n==='number'&&Number.isSafeInteger(n)&&n>0;
export function validateCasebook(input:unknown,portfolio:Portfolio):PaymentCasebook{
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Invalid local proof casebook');
 const p=input as Record<string,unknown>;
 if(p.version!==1||!Array.isArray(p.entries)||p.entries.length>300)throw Error('Unsupported or oversized casebook');
 const chargeIds=new Set(portfolio.charges.map(c=>c.id));
 const used=new Map<string,string>();
 const entries:ObservedPayment[]=[];
 for(const e of p.entries){
  if(!e||typeof e!=='object'||Array.isArray(e))throw Error('Invalid evidence entry');
  const x=e as Record<string,unknown>;
  if(typeof x.chargeId!=='string'||!chargeIds.has(x.chargeId)||!hashOk(x.hash)||
    !positive(x.amountLuna)||!stampOk(x.observedAt)||x.rpcUrl!=='https://rpc.nimiqwatch.com/'||
    x.network!=='MainAlbatross'||!positive(x.blockHeight)||!positive(x.macroHeight)||
    x.macroHeight<=x.blockHeight||x.source!=='single-public-rpc')throw Error('Invalid untrusted chain observation');
  const key=x.hash.toLowerCase(),owner=used.get(key);
  if(owner&&owner!==x.chargeId)throw Error('The same transaction hash cannot be associated with different charges');
  if(owner)throw Error('Duplicate observation for one transaction');
  used.set(key,x.chargeId);
  entries.push({chargeId:x.chargeId,hash:key,amountLuna:x.amountLuna,observedAt:x.observedAt,rpcUrl:x.rpcUrl,
    network:'MainAlbatross',blockHeight:x.blockHeight,macroHeight:x.macroHeight,source:'single-public-rpc'});
 }
 return {version:1,entries};
}
export function saveObservedMatch(
 book:PaymentCasebook, portfolio:Portfolio, chargeId:string, result:VerifyResult
):PaymentCasebook{
 const charge=portfolio.charges.find(c=>c.id===chargeId);
 if(!charge)throw Error('Select a real local charge');
 if(result.state!=='FINAL_MATCHED'||result.network!=='MainAlbatross'||result.evidenceSource!=='single-public-rpc'||
   !positive(result.amountLuna)||!positive(result.blockHeight)||!positive(result.macroHeight)||
   !hashOk(result.hash)||!stampOk(result.observedAt)||result.rpcUrl!=='https://rpc.nimiqwatch.com/')
   throw Error('Only complete single-node FINAL_MATCHED observations can be saved');
 if(result.amountLuna>charge.amountLuna)throw Error('Reported transfer exceeds this invoice; requires manual review');
 const verified=validateCasebook(book,portfolio);
 if(verified.entries.some(e=>e.hash===result.hash.toLowerCase()))throw Error('This hash has already been recorded. Recheck it instead.');
 return validateCasebook({version:1,entries:[...verified.entries,{
  chargeId,hash:result.hash.toLowerCase(),amountLuna:result.amountLuna,observedAt:result.observedAt,
  rpcUrl:result.rpcUrl,network:result.network,blockHeight:result.blockHeight,macroHeight:result.macroHeight,
  source:'single-public-rpc'
 }]},portfolio);
}
export function casebookSummary(book:PaymentCasebook,portfolio:Portfolio,chargeId:string):{
 observedLuna:number;observations:number;unmatchedLuna:number;overLimit:boolean
}{
 const charge=portfolio.charges.find(c=>c.id===chargeId);
 if(!charge)throw Error('Unknown charge');
 const entries=validateCasebook(book,portfolio).entries.filter(x=>x.chargeId===chargeId);
 const sum=entries.reduce((n,x)=>n+x.amountLuna,0);
 return {observedLuna:sum,observations:entries.length,unmatchedLuna:Math.max(0,charge.amountLuna-sum),overLimit:sum>charge.amountLuna};
}
export function loadCasebook(portfolio:Portfolio):PaymentCasebook{
 try{
  const text=localStorage.getItem(CASEBOOK_KEY);
  return text?validateCasebook(JSON.parse(text),portfolio):{version:1,entries:[]};
 }catch{return {version:1,entries:[]}}
}
export function persistCasebook(book:PaymentCasebook,portfolio:Portfolio):void{
 localStorage.setItem(CASEBOOK_KEY,JSON.stringify(validateCasebook(book,portfolio)));
}
