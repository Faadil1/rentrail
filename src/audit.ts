import { validateSharedRequest, type SharedRequest } from './domain.ts';

export interface PublicPaymentAudit {
  v: 1;
  request: SharedRequest;
  txHash: string;
}
const HEX_HASH=/^[0-9a-f]{64}$/i;

/** A public, tamperable link. It is not a signature or proof of landlord identity. */
export function createPaymentAudit(request: SharedRequest, hash: string): PublicPaymentAudit {
  const validated=validateSharedRequest(request);
  if(typeof hash!=='string'||!HEX_HASH.test(hash))throw Error('Expected a 64-character public transaction hash.');
  return {v:1,request:validated,txHash:hash.toLowerCase()};
}
export function encodePaymentAudit(audit: PublicPaymentAudit): string {
  const valid=createPaymentAudit(audit.request,audit.txHash);
  if(audit.v!==1)throw Error('Unsupported audit link version.');
  const json=JSON.stringify(valid);
  // Request contains only ASCII addresses/opaque memo/month/amount, never private tenancy labels.
  if(!/^[\x20-\x7e]+$/.test(json))throw Error('Unexpected Unicode in public audit payload.');
  return btoa(json).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'');
}
export function decodePaymentAudit(encoded: string): PublicPaymentAudit {
  if(typeof encoded!=='string'||encoded.length>2000||encoded.length<10||!/^[A-Za-z0-9_-]+$/.test(encoded))
    throw Error('Malformed public verification link.');
  let parsed:unknown;
  try{
    const b64=encoded.replace(/-/g,'+').replace(/_/g,'/');
    parsed=JSON.parse(atob(b64));
  }catch{throw Error('Invalid public verification link data.');}
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw Error('Invalid verification link.');
  const value=parsed as Record<string,unknown>;
  if(value.v!==1)throw Error('Unsupported verification link version.');
  if(!value.request||typeof value.request!=='object')throw Error('Missing rent request.');
  return createPaymentAudit(value.request as SharedRequest,value.txHash as string);
}
export function auditUrl(origin:string,pathname:string,audit:PublicPaymentAudit):string {
  const url=new URL(pathname,origin);
  url.searchParams.set('audit',encodePaymentAudit(audit));
  return url.toString();
}
