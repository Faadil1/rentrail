import {assertPeriod, isSafeLuna, looksLikeNimiqAddress, makeMemo, type Portfolio} from './domain.ts';

export interface PortableWorkspace {
  format:'rentrail-workspace';
  version:1;
  exportedAt:string;
  portfolio:Portfolio;
}
const MAX_IMPORT_BYTES=200_000;
const validId=(id:unknown):id is string=>typeof id==='string'&&/^[a-z0-9_-]{1,64}$/i.test(id);
const validDate=(s:unknown):s is string=>typeof s==='string'&&s.length<=40&&Number.isFinite(Date.parse(s));
const unique=(a:string[])=>new Set(a).size===a.length;
const field=(s:unknown,max:number):s is string=>typeof s==='string'&&s.trim().length>0&&s.length<=max&&!/[\u0000-\u001f\u007f]/.test(s);
const records=(x:unknown,max:number):x is Record<string,unknown>[]=>Array.isArray(x)&&x.length<=max&&x.every(v=>v!==null&&typeof v==='object'&&!Array.isArray(v));
const fail=(s:string):never=>{throw Error('Workspace backup rejected: '+s)};

/** Do not deserialize arbitrary file data as trusted payment evidence. */
export function validateWorkspacePortfolio(raw:unknown):Portfolio{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return fail('portfolio object is missing');
 const p=raw as Record<string,unknown>;
 if(p.schemaVersion!==1||!records(p.properties,100)||!records(p.units,400)||!records(p.charges,1000)||!records(p.submissions,1000))return fail('unsupported schema or oversized records');
 const buildings=p.properties;
 const units=p.units;
 const charges=p.charges;
 const submissions=p.submissions;
 if(!buildings.every(b=>validId(b.id)&&field(b.name,70)&&validDate(b.createdAt))||!unique(buildings.map(b=>String(b.id))))return fail('invalid or duplicate properties');
 const buildingIds=new Set(buildings.map(b=>b.id));
 if(!units.every(u=>validId(u.id)&&buildingIds.has(u.propertyId)&&field(u.label,60))||!unique(units.map(u=>String(u.id))))return fail('invalid, missing-property or duplicate units');
 const unitIds=new Set(units.map(u=>u.id));
 if(!charges.every(c=>{
   if(!validId(c.id)||!/^[a-f0-9]{32}$/.test(String(c.id))||!unitIds.has(c.unitId)||typeof c.amountLuna!=='number'||!isSafeLuna(c.amountLuna)||
   typeof c.recipient!=='string'||!looksLikeNimiqAddress(c.recipient)||!validDate(c.createdAt)||typeof c.period!=='string')return false;
   try{assertPeriod(c.period);return c.memo===makeMemo(c.id)}catch{return false}
 })||!unique(charges.map(c=>String(c.id)))||!unique(charges.map(c=>String(c.memo)))||
 !unique(charges.map(c=>String(c.unitId)+'/'+String(c.period))))return fail('invalid or duplicated rent charges');
 const chargeIds=new Set(charges.map(c=>c.id));
 if(!submissions.every(s=>chargeIds.has(s.chargeId)&&validDate(s.createdAt)&&['OUTCOME_UNKNOWN','SUBMITTED_UNVERIFIED'].includes(String(s.state))&&
   (s.hash===null||typeof s.hash==='string'&&/^[a-f0-9]{64}$/i.test(s.hash)))||
   !unique(submissions.map(s=>String(s.chargeId))))return fail('invalid or duplicated unverified submissions');
 return {
   schemaVersion:1,
   properties:buildings.map(b=>({id:String(b.id),name:String(b.name),createdAt:String(b.createdAt)})),
   units:units.map(u=>({id:String(u.id),propertyId:String(u.propertyId),label:String(u.label)})),
   charges:charges.map(c=>({id:String(c.id),unitId:String(c.unitId),period:String(c.period),amountLuna:Number(c.amountLuna),recipient:String(c.recipient).replace(/\s+/g,'').toUpperCase(),memo:String(c.memo),createdAt:String(c.createdAt)})),
   submissions:submissions.map(s=>({chargeId:String(s.chargeId),hash:s.hash===null?null:String(s.hash).toLowerCase(),state:s.state as 'SUBMITTED_UNVERIFIED'|'OUTCOME_UNKNOWN',createdAt:String(s.createdAt)})),
 };
}
export function createWorkspaceBackup(portfolio:Portfolio,now=new Date().toISOString()):string{
 const validated=validateWorkspacePortfolio(portfolio);
 if(!validDate(now))throw Error('Invalid export timestamp');
 const result=JSON.stringify({format:'rentrail-workspace',version:1,exportedAt:now,portfolio:validated} satisfies PortableWorkspace);
 if(result.length>MAX_IMPORT_BYTES)throw Error('Workspace too large to back up');
 return result;
}
export function readWorkspaceBackup(source:string):PortableWorkspace{
 if(typeof source!=='string'||source.length<40||source.length>MAX_IMPORT_BYTES)return fail('missing or oversized JSON');
 let raw:unknown;
 try{raw=JSON.parse(source)}catch{return fail('invalid JSON')}
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return fail('invalid document');
 const d=raw as Record<string,unknown>;
 if(d.format!=='rentrail-workspace'||d.version!==1||!validDate(d.exportedAt))return fail('unsupported backup format or version');
 return {format:'rentrail-workspace',version:1,exportedAt:String(d.exportedAt),portfolio:validateWorkspacePortfolio(d.portfolio)};
}
export function backupSummary(p:Portfolio):{properties:number;units:number;charges:number;unverified:number}{
 return {properties:p.properties.length,units:p.units.length,charges:p.charges.length,unverified:p.submissions.length};
}
