import { ed25519 } from '@noble/curves/ed25519.js';
import { blake2b } from '@noble/hashes/blake2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { compactNimiqAddress, isValidNimiqAddress } from './address-validation.ts';
import { asciiJson } from './domain.ts';

/** Nimiq signed-message prefix (Hub / Keyguard standard). */
export const NIMIQ_MSG_PREFIX = '\x16Nimiq Signed Message:\n';
const ALPHABET = '0123456789ABCDEFGHJKLMNPQRSTUVXY';

function hexToBytes(hex: string): Uint8Array | null {
  const h = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (h.length % 2 || !/^[0-9a-f]*$/i.test(h)) return null;
  return Uint8Array.from(h.match(/.{2}/g) ?? [], b => parseInt(b, 16));
}
function base64ToBytes(v: string): Uint8Array | null {
  try { const s = atob(v.replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(s, c => c.charCodeAt(0)); } catch { return null; }
}
/** Accepts hex (Nimiq default) or base64, and the byte arrays some hosts return. */
export function decodeBytes(v: unknown, length: number): Uint8Array | null {
  let out: Uint8Array | null = null;
  if (v instanceof Uint8Array) out = v;
  else if (Array.isArray(v) && v.every(n => Number.isInteger(n) && n >= 0 && n < 256)) out = Uint8Array.from(v);
  else if (typeof v === 'string') out = hexToBytes(v) ?? base64ToBytes(v);
  return out && out.length === length ? out : null;
}
function mod97(digits: string): number {
  let m = 0;
  for (const ch of digits) m = (m * 10 + Number(ch)) % 97;
  return m;
}
/** Nimiq address of an Ed25519 public key: first 20 bytes of BLAKE2b-256, base32, IBAN check digits. */
export function addressFromPublicKey(publicKey: Uint8Array): string {
  if (publicKey.length !== 32) throw Error('Invalid public key.');
  const raw = blake2b(publicKey, { dkLen: 32 }).slice(0, 20);
  let bits = '';
  for (const b of raw) bits += b.toString(2).padStart(8, '0');
  let body = '';
  for (let i = 0; i < 160; i += 5) body += ALPHABET[parseInt(bits.slice(i, i + 5), 2)];
  const numeric = (body + 'NQ00').split('').map(c => (/[0-9]/.test(c) ? c : String(c.charCodeAt(0) - 55))).join('');
  const check = String(98 - mod97(numeric)).padStart(2, '0');
  return ('NQ' + check + body).match(/.{4}/g)!.join(' ');
}

/** The canonical, human-readable text a landlord signs for a rent request. ASCII only. */
export function rentRequestMessage(r: { recipient: string; amountLuna: number; period: string; memo: string; title?: string }): string {
  const nim = (r.amountLuna / 100_000).toFixed(5).replace(/0+$/, '').replace(/\.$/, '');
  const title = r.title ? `\nFor: ${asciiJson(r.title)}` : '';
  return `RentRail rent request${title}\nPay to: ${compactNimiqAddress(r.recipient)}\nAmount: ${nim} NIM (${r.amountLuna} Luna)\nMonth: ${r.period}\nReference: ${r.memo}`;
}
/** The text a tenant signs to claim a payment as theirs. ASCII only. */
export function paymentClaimMessage(memo: string, txHash: string): string {
  return `RentRail payment\nReference: ${memo}\nTransaction: ${txHash.toLowerCase()}`;
}

export interface SignedBy { publicKey: string; signature: string }
export type SignatureCheck = { valid: true; signer: string } | { valid: false; reason: string };

/**
 * Verifies an Ed25519 signature of `message` and returns the signer's Nimiq address.
 * The standard Nimiq signed-message hash is checked first; the raw prefixed and raw
 * message encodings are accepted too (each still binds the exact message to the key).
 */
export function verifySignedMessage(message: string, signed: SignedBy | null | undefined): SignatureCheck {
  if (!signed) return { valid: false, reason: 'Not signed.' };
  const pub = decodeBytes(signed.publicKey, 32);
  const sig = decodeBytes(signed.signature, 64);
  if (!pub || !sig) return { valid: false, reason: 'Malformed signature.' };
  const enc = new TextEncoder();
  const prefixed = enc.encode(NIMIQ_MSG_PREFIX + enc.encode(message).length + message);
  const candidates = [sha256(prefixed), prefixed, enc.encode(message)];
  let ok = false;
  for (const data of candidates) {
    try { if (ed25519.verify(sig, data, pub)) { ok = true; break; } } catch { /* try next encoding */ }
  }
  if (!ok) return { valid: false, reason: 'The signature does not match this request.' };
  return { valid: true, signer: addressFromPublicKey(pub) };
}

export function sameAddress(a: string, b: string): boolean {
  return isValidNimiqAddress(a) && isValidNimiqAddress(b) && compactNimiqAddress(a) === compactNimiqAddress(b);
}

/** Normalizes what the wallet's sign() returned into hex strings. */
export function normalizeSignResult(result: unknown): SignedBy | null {
  if (!result || typeof result !== 'object') return null;
  const r = result as Record<string, unknown>;
  const pub = decodeBytes(r.publicKey ?? r.signerPublicKey, 32);
  const sig = decodeBytes(r.signature, 64);
  if (!pub || !sig) return null;
  const hex = (b: Uint8Array) => Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
  return { publicKey: hex(pub), signature: hex(sig) };
}
