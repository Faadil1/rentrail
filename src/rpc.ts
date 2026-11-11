import { isSafeLuna, looksLikeNimiqAddress, normalizeAddress } from './domain.ts';

/** Third-party node claim, NOT cryptographic light-client verification and NOT a legal rent receipt. */
export const PUBLIC_RPC = 'https://rpc.nimiqwatch.com/';
export const MAIN_ALBATROSS_NETWORK_ID = 24;
export type ReadMethod =
  | 'isConsensusEstablished' | 'getLatestBlock' | 'getTransactionByHash'
  | 'getBlockByNumber' | 'getMacroBlockAfter' | 'getTransactionsByBlockNumber' | 'getTransactionsByAddress';

const allowedMethods = new Set<ReadMethod>([
  'isConsensusEstablished', 'getLatestBlock', 'getTransactionByHash',
  'getBlockByNumber', 'getMacroBlockAfter', 'getTransactionsByBlockNumber', 'getTransactionsByAddress',
]);
export type RpcReader = (method: ReadMethod, params: unknown[]) => Promise<unknown>;
export interface VerifyInput {
  hash: string;
  recipient: string;
  memo: string;
  amountLuna: number;
  allowPartial?: boolean;
}
export type VerifyState = 'FINAL_MATCHED' | 'INCLUDED_NOT_FINAL' | 'REVIEW_REQUIRED' | 'NOT_FOUND' | 'UNKNOWN';
export interface VerifyResult {
  state: VerifyState;
  message: string;
  evidenceSource: 'single-public-rpc';
  rpcUrl: string;
  observedAt: string;
  hash: string;
  network: 'MainAlbatross' | 'UNVERIFIED';
  blockHeight?: number;
  macroHeight?: number;
  amountLuna?: number;
}
interface Row { [key: string]: unknown }
const row = (v: unknown): Row | null => v!==null && typeof v==='object' && !Array.isArray(v) ? v as Row : null;
const nonnegativeInt = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number)>=0;
const height = (v: unknown): v is number => nonnegativeInt(v) && v>0;
const validHash = (v: unknown): v is string => typeof v==='string' && /^[a-f0-9]{64}$/i.test(v);
const networkIsMain = (v: unknown): boolean => v==='MainAlbatross' || v==='main-albatross';
const safeValue = (v: unknown): number | null => {
  if (typeof v==='number') return isSafeLuna(v)?v:null;
  if (typeof v==='string' && /^[1-9][0-9]*$/.test(v)) {
    const n=BigInt(v);
    return n<=BigInt(Number.MAX_SAFE_INTEGER)?Number(n):null;
  }
  return null;
};
/** Nimiq PoS recipientData is hex; never treat malformed or missing bytes as an empty memo. */
export function decodeRecipientData(value: unknown): string | null {
  if (typeof value!=='string') return null;
  const hex=value.startsWith('0x')?value.slice(2):value;
  if (hex.length%2!==0||!/^[a-f0-9]*$/i.test(hex)) return null;
  if (hex.length>128) return null; // Max 64 bytes Nimiq Pay memo
  try {
    const bytes=new Uint8Array((hex.match(/.{2}/g)||[]).map(x=>parseInt(x,16)));
    return new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  } catch { return null; }
}

export function createReadOnlyRpc(fetcher: typeof fetch = fetch): RpcReader {
  let requestId = 0;
  return async (method,params) => {
    if (!allowedMethods.has(method)) throw Error('RPC method is not read-only allowed.');
    const id=++requestId;
    let response: Response;
    try {
      response=await fetcher(PUBLIC_RPC,{
        method:'POST',mode:'cors',redirect:'error',credentials:'omit',cache:'no-store',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({jsonrpc:'2.0',id,method,params}),
        signal:AbortSignal.timeout(10000),
      });
    } catch {
      throw Error('RPC unreachable, timed out or blocked by browser CORS. NOT_VERIFIED.');
    }
    if (!response.ok) throw Error('RPC returned HTTP '+response.status+'. NOT_VERIFIED.');
    let envelope: unknown;
    try { envelope=await response.json(); } catch { throw Error('RPC returned invalid JSON. NOT_VERIFIED.'); }
    const e=row(envelope);
    const result=row(e?.result);
    if(e?.jsonrpc!=='2.0'||e?.id!==id||e?.error||!result||
       !Object.prototype.hasOwnProperty.call(result,'data')){
      throw Error('Unexpected PoS JSON-RPC envelope. NOT_VERIFIED.');
    }
    return result.data;
  };
}
export interface RpcNetworkCheck {
  state: 'MAINNET_REPORTED' | 'NOT_VERIFIED';
  message: string;
  observedAt: string;
  headHeight?: number;
  network?: string;
  rpcUrl: string;
}
export async function checkPublicMainnetRpc(
  rpc: RpcReader=createReadOnlyRpc(), nowMs=Date.now()
):Promise<RpcNetworkCheck>{
  const observedAt=new Date(nowMs).toISOString();
  const base={observedAt,rpcUrl:PUBLIC_RPC};
  try {
    const consensus=await rpc('isConsensusEstablished',[]);
    const latest=row(await rpc('getLatestBlock',[false]));
    if(consensus!==true||!latest||!height(latest.number)||!networkIsMain(latest.network)||
       typeof latest.timestamp!=='number'||!Number.isFinite(latest.timestamp)||
       latest.timestamp>nowMs+120_000||nowMs-latest.timestamp>600_000){
      return {...base,state:'NOT_VERIFIED',message:'RPC consensus, mainnet label or freshness was not independently established.'};
    }
    return {...base,state:'MAINNET_REPORTED',message:'One public RPC history node reports a recent MainAlbatross head and established consensus; wallet network and individual transactions remain unverified.',
      headHeight:latest.number,network:String(latest.network)};
  }catch(error){return {...base,state:'NOT_VERIFIED',
    message:'RPC request failed (network, CORS or endpoint): '+(error instanceof Error?error.message:'Unknown error')};}
}

function result(state: VerifyState, message: string, inputHash: string, observedAt: string,
  network: VerifyResult['network']='UNVERIFIED', extras: Partial<VerifyResult>={}): VerifyResult {
  return {state,message,evidenceSource:'single-public-rpc',rpcUrl:PUBLIC_RPC,
    observedAt,hash:inputHash,network,...extras};
}
/**
 * Read-only independent-of-wallet reconciliation. Fails closed on any missing fields.
 * A FINAL_MATCHED result means one untrusted history node observed an included,
 * executed transaction with exactly matching tuple and later canonical macro block.
 * It must not automatically satisfy a contractual rent obligation.
 */
export async function verifyNimTransaction(
  input: VerifyInput, rpc: RpcReader=createReadOnlyRpc(), nowMs=Date.now()
): Promise<VerifyResult> {
  const observedAt=new Date(nowMs).toISOString();
  const hash=typeof input.hash==='string'?input.hash.trim().toLowerCase():'';
  const unverified=(message: string, state: VerifyState='UNKNOWN', extras: Partial<VerifyResult>={})=>
    result(state,message,hash,observedAt,'UNVERIFIED',extras);
  if(!validHash(hash)||!looksLikeNimiqAddress(input.recipient)||
     !/^STUB1:[a-f0-9]{32}$/.test(input.memo)||!isSafeLuna(input.amountLuna)){
    return unverified('Invalid transaction hash or rent request. Nothing was verified.','REVIEW_REQUIRED');
  }
  try {
    const consensus=await rpc('isConsensusEstablished',[]);
    if(consensus!==true) return unverified('RPC node has no established consensus.');
    const head=row(await rpc('getLatestBlock',[false]));
    if(!head||!height(head.number)||!networkIsMain(head.network)||
       typeof head.timestamp!=='number'||!Number.isFinite(head.timestamp)||
       head.timestamp>nowMs+120_000 || nowMs-head.timestamp>600_000){
      return unverified('RPC mainnet identity, block height or freshness was not attested.');
    }
    const txValue=await rpc('getTransactionByHash',[hash]);
    if(txValue===null) return unverified('Hash not found in this history node. It may not be included.', 'NOT_FOUND');
    const tx=row(txValue);
    if(!tx||!validHash(tx.hash)||tx.hash.toLowerCase()!==hash||
       tx.networkId!==MAIN_ALBATROSS_NETWORK_ID) {
      return unverified('Transaction hash/network ID is missing, malformed or not mainnet.','REVIEW_REQUIRED');
    }
    if(tx.executionResult!==true) {
      return unverified('Execution was not confirmed successful; do not credit rent.','REVIEW_REQUIRED');
    }
    if(typeof tx.to!=='string'||normalizeAddress(tx.to)!==normalizeAddress(input.recipient))
      return unverified('On-chain recipient does not match the rent request.','REVIEW_REQUIRED');
    const memo=decodeRecipientData(tx.recipientData);
    if(memo!==input.memo) return unverified('Public reference does not match this rent period.','REVIEW_REQUIRED');
    const amount=safeValue(tx.value);
    if(amount===null|| (input.allowPartial===true ? amount>input.amountLuna : amount!==input.amountLuna))
      return unverified('Transferred Luna amount does not match this request or exceeds the charge.','REVIEW_REQUIRED');
    if(!height(tx.blockNumber)||tx.blockNumber>head.number)
      return unverified('Canonical block height absent or ahead of verified head.','UNKNOWN');
    const blockHeight=tx.blockNumber as number;
    const block=row(await rpc('getBlockByNumber',[blockHeight,false]));
    if(!block||block.number!==blockHeight||block.type!=='micro'||
       !networkIsMain(block.network)||!validHash(block.hash))
      return unverified('Canonical main-chain microblock could not be verified.','UNKNOWN',{blockHeight});
    const list=await rpc('getTransactionsByBlockNumber',[blockHeight]);
    if(!Array.isArray(list)||!list.some(v=>row(v)?.hash===hash))
      return unverified('Transaction not found in canonical block transaction list.','UNKNOWN',{blockHeight});
    const macroAt=await rpc('getMacroBlockAfter',[blockHeight]);
    if(!height(macroAt)||macroAt<=blockHeight)
      return unverified('Following macroblock height unavailable.','UNKNOWN',{blockHeight});
    if(head.number<macroAt)
      return result('INCLUDED_NOT_FINAL','Included in canonical microblock; waiting for the next macroblock.',
        hash,observedAt,'MainAlbatross',{blockHeight,macroHeight:macroAt,amountLuna:amount});
    const macro=row(await rpc('getBlockByNumber',[macroAt,false]));
    if(!macro||macro.number!==macroAt||macro.type!=='macro'||
       !networkIsMain(macro.network)||!validHash(macro.hash))
      return unverified('Following canonical macroblock is missing or malformed.','UNKNOWN',{blockHeight,macroHeight:macroAt});
    return result('FINAL_MATCHED',
      'One public Nimiq mainnet history node reports an executed, canonical transfer with matching recipient, Luna amount and opaque rent reference; a later macroblock is present. This is NOT a legally settled rent receipt or multi-node attestation.',
      hash,observedAt,'MainAlbatross',{blockHeight,macroHeight:macroAt,amountLuna:amount});
  } catch(err) {
    return unverified('RPC verification failed: '+(err instanceof Error?err.message:'Unknown error')+'. No payment credit.');
  }
}

export interface IncomingCandidate { hash: string; memo: string; amountLuna: number }
/**
 * Lists recent incoming transfers to `address` that carry an STUB1 rent reference.
 * Candidates only: each one must still pass verifyNimTransaction() before it is credited.
 */
export async function findIncomingRentPayments(
  address: string, rpc: RpcReader=createReadOnlyRpc(), max=200,
): Promise<IncomingCandidate[]> {
  if(!looksLikeNimiqAddress(address))throw Error('Invalid address.');
  const list=await rpc('getTransactionsByAddress',[address,max,null]);
  if(!Array.isArray(list))throw Error('Unexpected history response.');
  const out:IncomingCandidate[]=[];
  const seen=new Set<string>();
  for(const v of list){
    const tx=row(v);
    if(!tx||!validHash(tx.hash)||seen.has(tx.hash.toLowerCase()))continue;
    if(typeof tx.to!=='string'||normalizeAddress(tx.to)!==normalizeAddress(address))continue;
    if(tx.executionResult===false)continue;
    const memo=decodeRecipientData(tx.recipientData);
    if(!memo||!/^STUB1:[a-f0-9]{32}$/.test(memo))continue;
    const amount=safeValue(tx.value);
    if(amount===null)continue;
    seen.add(tx.hash.toLowerCase());
    out.push({hash:tx.hash.toLowerCase(),memo,amountLuna:amount});
  }
  return out;
}
