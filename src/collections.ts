import { assertPeriod, formatNim, projectCharge, type Portfolio, type Charge } from './domain.ts';

export type DueDays = Record<string, number>;
export type AgeBucket = 'UPCOMING' | 'DUE_TODAY' | '1–7 DAYS' | '8–30 DAYS' | '31+ DAYS';
export type QueueState = 'OPEN_LOCAL' | 'TX_NEEDS_VERIFICATION';
export interface CollectionLine {
  chargeId:string; propertyId:string; propertyName:string; unitId:string; unitLabel:string;
  period:string; amountLuna:number; outstandingLuna:number; recipient:string;
  dueDate:string; daysLate:number; ageBucket:AgeBucket; state:QueueState;
  hasSubmittedHash:boolean;
}
export interface CollectionQueue {
  asOf:string; lines:CollectionLine[]; outstandingLuna:number;
  overdueLuna:number; overdueCount:number; awaitingProofCount:number;
  ageBuckets:Record<AgeBucket,{count:number;luna:number}>;
}

export function validDueDay(day:unknown):day is number {
  return Number.isInteger(day)&&Number(day)>=1&&Number(day)<=28;
}
export function dueDateFor(period:string,day=1):string {
  assertPeriod(period);
  if(!validDueDay(day))throw Error('Due day must be between 1 and 28.');
  return period+'-'+String(day).padStart(2,'0');
}
export function utcCalendarDate(value:string):number {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))throw Error('Expected YYYY-MM-DD');
  const ms=Date.parse(value+'T00:00:00Z');
  if(!Number.isFinite(ms)||new Date(ms).toISOString().slice(0,10)!==value)throw Error('Invalid calendar date.');
  return ms;
}
export function collectionQueue(portfolio:Portfolio,asOf:string,dueDays:DueDays={},propertyId=''):CollectionQueue {
  const today=utcCalendarDate(asOf);
  if(propertyId&&!portfolio.properties.some(p=>p.id===propertyId))throw Error('Unknown property.');
  for(const day of Object.values(dueDays)){if(!validDueDay(day))throw Error('Invalid saved due-day settings.');}
  const buckets:CollectionQueue['ageBuckets']={
    UPCOMING:{count:0,luna:0},DUE_TODAY:{count:0,luna:0},
    '1–7 DAYS':{count:0,luna:0},'8–30 DAYS':{count:0,luna:0},'31+ DAYS':{count:0,luna:0},
  };
  const units=new Map(portfolio.units.map(u=>[u.id,u]));
  const properties=new Map(portfolio.properties.map(p=>[p.id,p]));
  let outstandingLuna=0,overdueLuna=0,overdueCount=0,awaitingProofCount=0;
  const lines:CollectionLine[]=[];
  for(const charge of portfolio.charges) {
    const unit=units.get(charge.unitId);
    if(!unit||!properties.has(unit.propertyId))continue;
    if(propertyId&&unit.propertyId!==propertyId)continue;
    const dueDate=dueDateFor(charge.period,dueDays[unit.id]??1);
    const difference=Math.floor((today-utcCalendarDate(dueDate))/86_400_000);
    const bucket:AgeBucket=difference<0?'UPCOMING':difference===0?'DUE_TODAY':
      difference<=7?'1–7 DAYS':difference<=30?'8–30 DAYS':'31+ DAYS';
    // No persisted, independently final evidence => never call an obligation settled.
    const projection=projectCharge(charge,[],portfolio.submissions);
    const hasSubmittedHash=portfolio.submissions.some(s=>s.chargeId===charge.id);
    const state:QueueState=hasSubmittedHash?'TX_NEEDS_VERIFICATION':'OPEN_LOCAL';
    const outstanding=projection.dueLuna;
    if(!Number.isSafeInteger(outstandingLuna+outstanding)||!Number.isSafeInteger(buckets[bucket].luna+outstanding))
      throw Error('Portfolio total exceeds supported Luna precision.');
    outstandingLuna+=outstanding;
    buckets[bucket].luna+=outstanding;buckets[bucket].count++;
    if(difference>0){overdueCount++;if(!Number.isSafeInteger(overdueLuna+outstanding))throw Error('Overdue total overflow');overdueLuna+=outstanding;}
    if(hasSubmittedHash)awaitingProofCount++;
    lines.push({chargeId:charge.id,propertyId:unit.propertyId,
      propertyName:properties.get(unit.propertyId)!.name,unitId:unit.id,unitLabel:unit.label,
      period:charge.period,amountLuna:charge.amountLuna,outstandingLuna:outstanding,recipient:charge.recipient,
      dueDate,daysLate:Math.max(0,difference),ageBucket:bucket,state,hasSubmittedHash});
  }
  lines.sort((a,b)=>a.dueDate.localeCompare(b.dueDate)||a.propertyName.localeCompare(b.propertyName)||a.unitLabel.localeCompare(b.unitLabel));
  return {asOf,lines,outstandingLuna,overdueLuna,overdueCount,awaitingProofCount,ageBuckets:buckets};
}

/**
 * Generates a human-reviewable reminder draft. No emails, notifications or
 * wallet transactions are sent. No tenant identifying information is required.
 */
export function reminderDraft(line:CollectionLine):string {
  const status=line.state==='TX_NEEDS_VERIFICATION'
    ?'A transfer may have been submitted, but its on-chain confirmation is still pending review.'
    :'Our local records do not yet contain independently verified payment evidence.';
  return `Rent request follow-up — ${line.period}\nProperty: ${line.propertyName}\nUnit: ${line.unitLabel}\nPeriod: ${line.period}\nRecorded amount: ${formatNim(line.amountLuna)} NIM\nExpected date: ${line.dueDate}\n${status}\nPlease check your payment history and share a public transaction hash for verification if you have already paid. This message is a draft, not proof of debt or a payment demand.`;
}
export function collectionCsv(queue:CollectionQueue):string {
  const esc=(value:unknown)=>'"'+String(value??'').replace(/"/g,'""').replace(/^[=+\-@\t\r]/,'\u0027$&')+'"';
  const header=['property','unit','period','due_date','recorded_nim','days_past_due','local_status','charge_reference'];
  const rows=queue.lines.map(x=>[x.propertyName,x.unitLabel,x.period,x.dueDate,formatNim(x.amountLuna),String(x.daysLate),x.state,x.chargeId]);
  return [header,...rows].map(row=>row.map(esc).join(',')).join('\r\n')+'\r\n';
}
