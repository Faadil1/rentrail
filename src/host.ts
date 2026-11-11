import { NimiqProviderError } from '@nimiq/mini-app-sdk';

/** Turns SDK and validation errors into a short message for the user. */
export function explainHostError(error: unknown): string {
  if (NimiqProviderError.is(error)) {
    if (error.type === 'PERMISSION_DENIED') return 'Cancelled in Nimiq Pay.';
    if (error.type === 'NETWORK_ERROR') return 'Nimiq Pay reported a network error. Check your connection.';
    return `Nimiq Pay: ${error.message}`;
  }
  return error instanceof Error ? error.message : 'Something went wrong.';
}
