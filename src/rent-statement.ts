import { validateSharedRequest, type SharedRequest } from './domain.ts';
import { MAX_CLAIMS_PER_CHARGE } from './proof-desk.ts';

export interface PublicRentStatement {
  v:2;
  request:SharedRequest;
  hashes:string[];
}
const HASH=/^[0-9a-f]{64}$/i;
/**
 * Transport only. Public, editable, NOT signed and NOT on-chain evidence.
 * Another viewer MUST recheck each hash against a trusted mainnet RPC.
 */
export function createRentStatement(request:SharedRequest,hashes:string[]):PublicRentStatement {
  const safe=validateSharedRequest(request);
  if(!Array.isArray(hashes)||hashes.length===0||hashes.length>MAX_CLAIMS_PER_CHARGE)
    throw Error('Statement requires 1–8 public transaction hashes.');
  const normalized=hashes.map(x=>{
    if(typeof x!=='string'||!HASH.test(x))throw Error('Invalid transaction hash in statement.');
    return x.toLowerCase();
  });
  if(new Set(normalized).size!==normalized.length)throw Error('Repeated transaction hash in statement.');
  return {v:2,request:safe,hashes:normalized};
}
export function encodeRentStatement(statement:PublicRentStatement):string {
  if(statement.v!==2)throw Error('Invalid statement version.');
  const safe=createRentStatement(statement.request,statement.hashes);
  const json=JSON.stringify(safe);
  if(!/^[\x20-\x7e]+$/.test(json))throw Error('Unexpected non-ASCII statement content.');
  return btoa(json).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'');
}
export function decodeRentStatement(raw:string):PublicRentStatement {
  if(typeof raw!=='string'||raw.length<20||raw.length>2500||!/^[A-Za-z0-9_-]+$/.test(raw))
    throw Error('Invalid public statement link.');
  let decoded:unknown;
  try{decoded=JSON.parse(atob(raw.replace(/-/g,'+').replace(/_/g,'/')));}
  catch{throw Error('Malformed statement link encoding.');}
  if(!decoded||typeof decoded!=='object'||Array.isArray(decoded))throw Error('Malformed statement data.');
  const item=decoded as Record<string,unknown>;
  if(item.v!==2)throw Error('Unsupported statement version.');
  if(!Array.isArray(item.hashes))throw Error('Missing public transaction hashes.');
  return createRentStatement(validateSharedRequest(item.request),item.hashes);
}
export function rentStatementUrl(origin:string,pathname:string,statement:PublicRentStatement):string{
  if(!/^https:\/\//i.test(origin))throw Error('Public links must use HTTPS.');
  if(!pathname.startsWith('/')||pathname.startsWith('//'))throw Error('Invalid statement path.');
  return `${origin}${pathname}?statement=${encodeRentStatement(statement)}`;
}
