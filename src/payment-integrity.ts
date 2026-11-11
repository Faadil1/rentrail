import {type SharedRequest} from './domain.ts';
import {verifySignedMessage,rentRequestMessage,sameAddress} from './signature.ts';
import {leaseMessage,requestMatchesLease} from './lease.ts';

/**
 * Enforce signed-link integrity at the money-moving boundary, not just the UI.
 * An unsigned link is still accepted by product policy ONLY after the user
 * separately confirms its recipient in the interactive tenant view.
 */
export function signedPaymentIntegrityError(request: SharedRequest): string | null {
  if(request.lease) {
    if(request.sig) return 'Conflicting request signatures. Obtain a new rent link.';
    if(!requestMatchesLease(request)) return 'The monthly request does not match its original lease.';
    if(!request.lease.sig) return null; // Unsigned requests require independent human address confirmation.
    const checked=verifySignedMessage(leaseMessage(request.lease),request.lease.sig);
    if(!checked.valid||!sameAddress(checked.signer,request.recipient))
      return 'The signed monthly lease does not match the receiving wallet. Payment blocked.';
    return null;
  }
  if(!request.sig)return null;
  const checked=verifySignedMessage(rentRequestMessage(request),request.sig);
  if(!checked.valid||!sameAddress(checked.signer,request.recipient))
    return 'This signed rent request has invalid or modified payment details. Payment blocked.';
  return null;
}

