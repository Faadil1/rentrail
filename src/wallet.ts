import { init } from '@nimiq/mini-app-sdk';
import { isValidNimiqAddress, formatNimiqAddress } from './address-validation.ts';
import { normalizeSignResult, verifySignedMessage, sameAddress } from './signature.ts';
import type { Signed } from './domain.ts';

let providerPromise: ReturnType<typeof init> | null = null;
function provider() {
  providerPromise ??= init({ timeout: 8000 });
  providerPromise.catch(() => { providerPromise = null; });
  return providerPromise;
}

/**
 * "Sign in with Nimiq Pay": the user's identity in Stub is their Nimiq wallet address.
 * Nimiq Pay asks the user to share it; nothing else (no email, no password) exists.
 * listAccounts() returns the wallet address first (then the temporary HTLC address).
 */
export async function connectWallet(): Promise<string> {
  let p;
  try { p = await provider(); } catch { throw Error('Open Stub inside Nimiq Pay (Mini Apps) to connect your wallet.'); }
  const accounts = await p.listAccounts();
  const wallet = Array.isArray(accounts) ? accounts[0] : undefined;
  if (typeof wallet !== 'string' || !isValidNimiqAddress(wallet)) throw Error('Nimiq Pay did not share a valid wallet address.');
  return formatNimiqAddress(wallet);
}

/**
 * Signs `message` with the user's Nimiq key and checks the result locally before using it.
 * If `expectedSigner` is given, the signature must come from that address; otherwise
 * nothing is returned, so a wallet that signs differently can never produce a false alarm.
 */
export async function signWithWallet(message: string, expectedSigner?: string): Promise<{ signed: Signed; signer: string }> {
  let p;
  try { p = await provider(); } catch { throw Error('Open Stub inside Nimiq Pay to sign with your wallet.'); }
  const raw = await p.sign(message);
  const signed = normalizeSignResult(raw);
  if (!signed) throw Error('Nimiq Pay returned a signature Stub cannot read.');
  const check = verifySignedMessage(message, signed);
  if (!check.valid) throw Error('The signature from Nimiq Pay could not be verified.');
  if (expectedSigner && !sameAddress(check.signer, expectedSigner))
    throw Error('Nimiq Pay signed with a different address than this request\'s receiving address.');
  return { signed, signer: check.signer };
}
