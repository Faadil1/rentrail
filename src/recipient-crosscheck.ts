import { isValidNimiqAddress, compactNimiqAddress } from './address-validation.ts';

export type RecipientComparison = {
  state:'MATCH'|'MISMATCH'|'INVALID';
  message:string;
};

/**
 * A check against an address obtained through an independent trusted channel.
 * A match is not an identity proof or authorization to send a payment.
 */
export function compareIndependentRecipient(requestRecipient:string, userConfirmedRecipient:string):RecipientComparison {
  if(!isValidNimiqAddress(requestRecipient))
    return {state:'INVALID',message:'The request receiving address has an invalid Nimiq checksum. Do not pay.'};
  if(!isValidNimiqAddress(userConfirmedRecipient))
    return {state:'INVALID',message:'Paste a complete checksum-valid NQ address obtained independently.'};
  if(compactNimiqAddress(requestRecipient)!==compactNimiqAddress(userConfirmedRecipient))
    return {state:'MISMATCH',message:'These addresses differ. Stop and confirm directly with the landlord using a trusted channel.'};
  return {state:'MATCH',message:'The addresses match character for character. This does not prove who owns the wallet or authorize any payment.'};
}
