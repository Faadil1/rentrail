import {formatNim} from './domain.ts';
/** Manual, illustrative rate conversion only — never an executable wallet quote. */
export type ReferenceCurrency='CAD'|'USD'|'EUR'|'NGN';
export interface IllustratedRentAmount {
  currency:ReferenceCurrency;
  rentFiat:string;
  fiatPerNim:string;
  estimatedLuna:number;
  estimatedNim:string;
  disclaimer:string;
}
const validCurrency=(x:string):x is ReferenceCurrency=>
  x==='CAD'||x==='USD'||x==='EUR'||x==='NGN';

function scaledDecimal(value:string,places:number):bigint{
  const v=value.trim();
  if(!/^(0|[1-9]\d{0,11})(\.\d{1,8})?$/.test(v))
    throw Error('Enter a plain positive decimal number with no more than eight fraction digits.');
  const [whole,fraction='']=v.split('.');
  if(fraction.length>places)throw Error('Too many decimal digits for this field.');
  return BigInt(whole)*10n**BigInt(places)+BigInt(fraction.padEnd(places,'0')||'0');
}
/**
 * Fiat amount = NIM amount * manual fiat-per-NIM price.
 * Computes nearest Luna from exact decimal strings, never using floating-point currency arithmetic.
 */
export function illustrateRentNim(currency:string,rentFiat:string,fiatPerNim:string):IllustratedRentAmount{
 if(!validCurrency(currency))throw Error('Unsupported currency.');
 const cents=scaledDecimal(rentFiat,2);
 const rate=scaledDecimal(fiatPerNim,8);
 if(cents<=0n||rate<=0n)throw Error('Rent and reference price must be greater than zero.');
 const numerator=cents*1_000_000n*100_000n;
 const luna=(numerator+rate/2n)/rate; // Half-up to the nearest Luna.
 if(luna<=0n||luna>BigInt(Number.MAX_SAFE_INTEGER))
  throw Error('The estimate cannot be represented with safe NIM precision.');
 return {currency,rentFiat:rentFiat.trim(),fiatPerNim:fiatPerNim.trim(),estimatedLuna:Number(luna),
   estimatedNim:formatNim(Number(luna)),
   disclaimer:'Illustrative manual price only. Not a live rate, price lock, payment request, fiat exchange or wallet authorization. Fees and volatility are excluded.'};
}
