/**
 * Full Nimiq user-friendly-address validation (NQ + IBAN-style mod 97).
 *
 * Separate from looksLikeNimiqAddress(): structural validation is useful for
 * synthetic fixtures but must NOT authorize a real-money recipient.
 *
 * No lookup, account-ownership assertion or funds movement happens here.
 */
const NQ_ADDRESS=/^NQ[0-9]{2}[0-9A-HJ-NP-VX-Y]{32}$/;

export function compactNimiqAddress(address: string): string {
  if(typeof address!=='string')return '';
  return address.replace(/\s+/g,'').toUpperCase();
}

export function isValidNimiqAddress(address: string): boolean {
  const nq=compactNimiqAddress(address);
  if(!NQ_ADDRESS.test(nq))return false;
  const rearranged=nq.slice(4)+nq.slice(0,4);
  let mod=0;
  for(const ch of rearranged){
    const code=ch.charCodeAt(0);
    if(code>=48&&code<=57){
      mod=(mod*10+(code-48))%97;
    } else if(code>=65&&code<=90) {
      mod=(mod*100+(code-55))%97;
    } else return false;
  }
  return mod===1;
}
export function formatNimiqAddress(address:string):string {
  if(!isValidNimiqAddress(address))throw Error('Invalid Nimiq address checksum.');
  return compactNimiqAddress(address).match(/.{4}/g)!.join(' ');
}
