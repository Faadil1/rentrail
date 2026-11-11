/** Local transaction reference list, not evidence that any rent was settled. */
export const MAX_SAVED_HASHES=8;
export interface SavedHashReference {chargeId:string;hash:string;addedAt:string}
const idOk=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{32}$/.test(v);
const hashOk=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{64}$/i.test(v);
const timeOk=(v:unknown):v is string=>{
 if(typeof v!=='string'||v.length!==24)return false;
 const d=new Date(v);
 return Number.isFinite(d.valueOf())&&d.toISOString()===v;
};
export function parseSavedHashes(raw:string|null,knownChargeIds:ReadonlySet<string>):SavedHashReference[]{
 if(!raw||raw.length>4096)return [];
 let items:unknown;
 try{items=JSON.parse(raw)}catch{return [];}
 if(!Array.isArray(items)||items.length>MAX_SAVED_HASHES)return [];
 const seen=new Set<string>();
 const out:SavedHashReference[]=[];
 for(const item of items){
  if(!item||typeof item!=='object'||Array.isArray(item))return [];
  const x=item as Record<string,unknown>;
  if(!idOk(x.chargeId)||!knownChargeIds.has(x.chargeId)||!hashOk(x.hash)||!timeOk(x.addedAt))return [];
  const hash=x.hash.toLowerCase();
  if(seen.has(hash))return []; // One hash cannot represent two local rent requests.
  seen.add(hash);
  out.push({chargeId:x.chargeId,hash,addedAt:x.addedAt});
 }
 return out;
}
export function addSavedHash(refs:readonly SavedHashReference[],entry:SavedHashReference,knownChargeIds:ReadonlySet<string>):SavedHashReference[]{
 if(!idOk(entry.chargeId)||!knownChargeIds.has(entry.chargeId)||!hashOk(entry.hash)||!timeOk(entry.addedAt))
  throw Error('Invalid local payment review reference.');
 const hash=entry.hash.toLowerCase();
 const conflict=refs.find(x=>x.hash===hash);
 if(conflict){
  if(conflict.chargeId!==entry.chargeId)throw Error('This transaction hash is already linked to another rent request.');
  return [...refs];
 }
 if(refs.length>=MAX_SAVED_HASHES)throw Error('This local review list is full. Clear references you no longer need.');
 return [...refs,{chargeId:entry.chargeId,hash,addedAt:entry.addedAt}];
}
export function removeSavedHash(refs:readonly SavedHashReference[],hash:string):SavedHashReference[]{
 if(!hashOk(hash))return [...refs];
 return refs.filter(x=>x.hash!==hash.toLowerCase());
}
