import { looksLikeNimiqAddress, normalizeAddress } from './domain.ts';

export interface WalletReadProvider {
  listAccounts(): Promise<string[]>;
  getBalance?: (address: string) => Promise<number>;
}
export interface WalletAddressSnapshot {
  address: string;
  balanceLuna: number | null;
}
export interface WalletPreflight {
  network: 'mainnet';
  checkedAt: string;
  accounts: WalletAddressSnapshot[];
  warnings: string[];
  senderIdentified: false;
}
export const MAX_SHARED_ACCOUNTS = 8;

/**
 * Read-only Nimiq Pay account inventory.
 * listAccounts can show a native permission dialog; call ONLY from a button.
 * It does NOT reveal which account Nimiq Pay will pick to send a transaction.
 */
export async function inspectWalletAddresses(
  provider: WalletReadProvider, network: 'mainnet' | 'testnet' | 'unknown',
  nowMs = Date.now(),
): Promise<WalletPreflight> {
  if(network!=='mainnet') throw Error('Account inspection for the mainnet payment gate requires host MAINNET.');
  const shared=await provider.listAccounts();
  if(!Array.isArray(shared)||shared.length>MAX_SHARED_ACCOUNTS||shared.some(x=>typeof x!=='string'||!looksLikeNimiqAddress(x)))
    throw Error('Unexpected wallet account list; nothing was saved or authorized.');
  const addresses=shared.map(x=>normalizeAddress(x));
  if(new Set(addresses).size!==addresses.length)throw Error('Duplicate wallet addresses in response.');
  const warnings:string[]=[];
  if(!addresses.length)warnings.push('No Nimiq wallet address was shared.');
  if(typeof provider.getBalance!=='function')warnings.push('This Nimiq Pay version does not expose getBalance.');
  const accounts:WalletAddressSnapshot[]=[];
  // Sequential lookups avoid wallet/RPC rate-limit bursts. Never log addresses.
  for(const address of addresses){
    let balanceLuna:number|null=null;
    if(typeof provider.getBalance==='function'){
      try{
        const n=await provider.getBalance(address);
        if(Number.isSafeInteger(n)&&n>=0)balanceLuna=n;
        else warnings.push('One balance lookup returned an invalid amount.');
      }catch{warnings.push('A balance lookup failed; balance is unknown, not zero.');}
    }
    accounts.push({address,balanceLuna});
  }
  return {network:'mainnet',checkedAt:new Date(nowMs).toISOString(),accounts,warnings,senderIdentified:false};
}
/**
 * Conservative receiver check: if recipient appears in the payer's shared
 * wallet address list, insist on another independently confirmed recipient.
 * The API does not say which shared address will be chosen as sender.
 */
export function receivingAddressAssessment(snapshot:WalletPreflight,recipient:string):{
  recipientAppearsInWallet:boolean;mayProceedToHumanReview:boolean;message:string
}{
  if(!looksLikeNimiqAddress(recipient)){
    return {recipientAppearsInWallet:false,mayProceedToHumanReview:false,message:'Recipient is not structurally valid.'};
  }
  const own=snapshot.accounts.some(a=>a.address===normalizeAddress(recipient));
  return own
    ? {recipientAppearsInWallet:true,mayProceedToHumanReview:false,
       message:'Recipient is among accounts shared by the payer wallet; possible prohibited self-transfer. Use a separately confirmed address outside this wallet.'}
    : {recipientAppearsInWallet:false,mayProceedToHumanReview:true,
       message:'Recipient not in shared list. This does NOT prove which sender Nimiq Pay will select, ownership of the recipient, or that a payment is safe. Recheck native approval.'};
}
