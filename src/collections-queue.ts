import { type Portfolio, type Charge } from './domain.ts';
import {monthSnapshot} from './operations.ts';

export type CollectionPriority='MISSING_INVOICE'|'PAST_PERIOD_UNMATCHED'|'SUBMITTED_NOT_VERIFIED'|'CURRENT_PERIOD_UNMATCHED';
export interface CollectionAction {
  priority:CollectionPriority;
  period:string;
  propertyName:string;
  unitLabel:string;
  chargeId:string|null;
  amountLuna:number;
  note:string;
}
export interface CollectionQueue {
  period:string;
  totalActions:number;
  missingInvoices:number;
  submittedForReview:number;
  pastPeriodUnmatched:number;
  currentPeriodUnmatched:number;
  actions:CollectionAction[];
}
/**
 * Action queue tracks OFF-CHAIN bookkeeping only.
 * "Past-period unmatched" is deliberately NOT "late rent" because
 * contractual due dates/holidays/grace periods were never entered.
 * An earlier RPC check is not saved as enforceable rent settlement.
 */
export function buildCollectionQueue(p:Portfolio,period:string,propertyId=''):CollectionQueue {
 const snap=monthSnapshot(p,period,propertyId);
 const actions:CollectionAction[]=[];
 const selectedUnits=p.units.filter(u=>!propertyId||u.propertyId===propertyId);
 const billed=new Set(snap.lines.map(x=>x.charge.unitId));
 const chargeById=new Map<string,Charge>(p.charges.map(c=>[c.id,c]));
 for(const u of selectedUnits){
  if(billed.has(u.id))continue;
  const building=p.properties.find(b=>b.id===u.propertyId);
  actions.push({priority:'MISSING_INVOICE',period,propertyName:building?.name??'Unknown property',
   unitLabel:u.label,chargeId:null,amountLuna:0,note:'No local rent request for this unit in the selected period.'});
 }
 const pendingIds=new Set(p.submissions.map(s=>s.chargeId));
 for(const line of snap.lines){
  const flagged=pendingIds.has(line.charge.id);
  actions.push({priority:flagged?'SUBMITTED_NOT_VERIFIED':'CURRENT_PERIOD_UNMATCHED',
   period,propertyName:line.propertyName,unitLabel:line.unitLabel,
   chargeId:line.charge.id,amountLuna:line.outstandingLuna,
   note:flagged?'A wallet submission is recorded locally. Recheck transaction hash before counting funds.':'Local invoice has no matched, accepted chain evidence.'});
 }
 const past=p.charges.filter(c=>c.period<period &&
   selectedUnits.some(u=>u.id===c.unitId)&&!pendingIds.has(c.id));
 for(const c of past){
  const unit=selectedUnits.find(u=>u.id===c.unitId)!;
  const building=p.properties.find(b=>b.id===unit.propertyId);
  // Not claiming legally overdue: missing known due date and settlement acceptance.
  actions.push({priority:'PAST_PERIOD_UNMATCHED',period:c.period,propertyName:building?.name??'Unknown property',
    unitLabel:unit.label,chargeId:c.id,amountLuna:c.amountLuna,
    note:'Historical period with no locally accepted chain evidence. Review before contacting a tenant.'});
 }
 const sort:Record<CollectionPriority,number>={
  SUBMITTED_NOT_VERIFIED:0,PAST_PERIOD_UNMATCHED:1,MISSING_INVOICE:2,CURRENT_PERIOD_UNMATCHED:3,
 };
 actions.sort((a,b)=>sort[a.priority]-sort[b.priority]||
   a.period.localeCompare(b.period)||a.propertyName.localeCompare(b.propertyName)||a.unitLabel.localeCompare(b.unitLabel));
 return {period,totalActions:actions.length,missingInvoices:actions.filter(x=>x.priority==='MISSING_INVOICE').length,
  submittedForReview:actions.filter(x=>x.priority==='SUBMITTED_NOT_VERIFIED').length,
  pastPeriodUnmatched:actions.filter(x=>x.priority==='PAST_PERIOD_UNMATCHED').length,
  currentPeriodUnmatched:actions.filter(x=>x.priority==='CURRENT_PERIOD_UNMATCHED').length,actions};
}
