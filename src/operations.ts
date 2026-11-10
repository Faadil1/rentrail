import {
  addCharge, assertPeriod, makeMemo, projectCharge,
  type Portfolio, type Charge, type ChargeViewStatus, type Reconciliation,
} from './domain.ts';

export interface MonthLine {
  charge: Charge;
  propertyId: string;
  propertyName: string;
  unitLabel: string;
  status: ChargeViewStatus;
  outstandingLuna: number;
}
export interface MonthSnapshot {
  period: string;
  expectedLuna: number;
  outstandingLuna: number;
  activeUnits: number;
  unitsWithoutCharge: number;
  charges: number;
  awaitingProof: number;
  lines: MonthLine[];
}

/**
 * Calendar-month operations, not an automated payment schedule.
 * Works across year boundaries and validates YYYY-MM dates.
 */
export function nextMonth(period: string): string {
  assertPeriod(period);
  const year = Number(period.slice(0,4));
  const month = Number(period.slice(5,7));
  if(year===9999 && month===12)throw new Error('Period exceeds supported calendar range.');
  return month===12?`${year+1}-01`:`${year}-${String(month+1).padStart(2,'0')}`;
}

/** Local invoice planning only. Nothing is sent to a wallet. */
export function planNextPeriod(
  p: Portfolio,
  sourcePeriod: string,
  newIds: string[],
  createdAt: string,
): { portfolio: Portfolio; generated: number; skipped: number; newPeriod: string } {
  assertPeriod(sourcePeriod);
  if(!Number.isFinite(Date.parse(createdAt)))throw Error('Invalid creation timestamp.');
  const newPeriod = nextMonth(sourcePeriod);
  const source = p.charges.filter(c => c.period===sourcePeriod);
  if(source.length === 0)throw Error('No rent obligations exist for this month.');
  const eligible = source.filter(c=>!p.charges.some(x=>x.unitId===c.unitId&&x.period===newPeriod));
  if(eligible.length===0)throw Error('All selected units already have obligations for the next month.');
  if(newIds.length!==eligible.length)throw Error('One new secure random request ID is required per new charge.');
  if(new Set(newIds).size!==newIds.length)throw Error('Duplicate generated request identifiers.');
  let updated=p;
  for(let i=0;i<eligible.length;i++){
    const existing=eligible[i];
    const id=newIds[i];
    if(id===existing.id)throw Error('Cannot reuse the previous payment reference.');
    const next:Charge={
      id,unitId:existing.unitId,period:newPeriod,amountLuna:existing.amountLuna,
      recipient:existing.recipient,memo:makeMemo(id),createdAt,
    };
    updated=addCharge(updated,next);
  }
  return {portfolio:updated,generated:eligible.length,skipped:source.length-eligible.length,newPeriod};
}

/**
 * Trust note: snapshot summarizes local off-chain obligations and unverified wallet sends,
 * never an independent claim about cash received or legal rent payment.
 * Optional fresh node-reported projections are derived in memory; never persisted.
 */
export function monthSnapshot(p:Portfolio, period:string, propertyId='',live?:Record<string,Reconciliation>):MonthSnapshot {
  assertPeriod(period);
  if(propertyId && !p.properties.some(x=>x.id===propertyId))throw Error('Unknown property filter.');
  const units=p.units.filter(u=>!propertyId||u.propertyId===propertyId);
  const unitIds=new Set(units.map(u=>u.id));
  const selected=p.charges.filter(c=>c.period===period && unitIds.has(c.unitId));
  let expectedLuna=0,outstandingLuna=0,awaitingProof=0;
  const lines:MonthLine[]=selected.map(charge=>{
    if(!Number.isSafeInteger(expectedLuna+charge.amountLuna))throw Error('Portfolio amount exceeds safe integer precision.');
    expectedLuna+=charge.amountLuna;
    const projection=live?.[charge.id] ?? projectCharge(charge,[],p.submissions);
    // No rent is credited without independent verified evidence.
    if(!Number.isSafeInteger(outstandingLuna+projection.dueLuna))throw Error('Outstanding amount exceeds safe integer precision.');
    outstandingLuna+=projection.dueLuna;
    if(projection.status==='SUBMITTED_UNVERIFIED')awaitingProof++;
    const unit=units.find(u=>u.id===charge.unitId);
    const property=p.properties.find(x=>x.id===unit?.propertyId);
    return {charge, propertyId:property?.id??'',propertyName:property?.name??'Unknown property',
      unitLabel:unit?.label??'Unknown unit',status:projection.status,outstandingLuna:projection.dueLuna};
  });
  lines.sort((a,b)=>a.propertyName.localeCompare(b.propertyName)||a.unitLabel.localeCompare(b.unitLabel));
  const billed=new Set(selected.map(c=>c.unitId));
  return {period,expectedLuna,outstandingLuna,activeUnits:units.length,
    unitsWithoutCharge:units.filter(u=>!billed.has(u.id)).length,
    charges:selected.length,awaitingProof,lines};
}
