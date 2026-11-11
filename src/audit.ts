import { asciiJson, validateSharedRequest, validSigned, type SharedRequest, type Signed } from './domain.ts';

export interface PublicPaymentAudit {
  v: 1;
  request: SharedRequest;
  txHash: string;
  /** Tenant's wallet signature over paymentClaimMessage(memo, txHash): identifies who paid. */
  payer?: Signed;
}
const HEX_HASH=/^[0-9a-f]{64}$/i;

/** A public, tamperable link. It is not a signature or proof of landlord identity. */
export function createPaymentAudit(request: SharedRequest, hash: string, payer?: Signed): PublicPaymentAudit {
  const validated=validateSharedRequest(request);
  if(typeof hash!=='string'||!HEX_HASH.test(hash))throw Error('Expected a 64-character public transaction hash.');
  const audit:PublicPaymentAudit={v:1,request:validated,txHash:hash.toLowerCase()};
  if(payer!==undefined){if(!validSigned(payer))throw Error('Invalid payer signature.');audit.payer={publicKey:payer.publicKey,signature:payer.signature};}
  return audit;
}
export function encodePaymentAudit(audit: PublicPaymentAudit): string {
  const valid=createPaymentAudit(audit.request,audit.txHash,audit.payer);
  if(audit.v!==1)throw Error('Unsupported audit link version.');
  const json=asciiJson(valid);
  if(!/^[\x20-\x7e]+$/.test(json))throw Error('Unexpected characters in public audit payload.');
  return btoa(json).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'');
}
export function decodePaymentAudit(encoded: string): PublicPaymentAudit {
  if(typeof encoded!=='string'||encoded.length>3000||encoded.length<10||!/^[A-Za-z0-9_-]+$/.test(encoded))
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
  return createPaymentAudit(value.request as SharedRequest,value.txHash as string,value.payer as Signed|undefined);
}
export function auditUrl(origin:string,pathname:string,audit:PublicPaymentAudit):string {
  const url=new URL(pathname,origin);
  url.searchParams.set('audit',encodePaymentAudit(audit));
  return url.toString();
}
