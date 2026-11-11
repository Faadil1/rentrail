import assert from 'node:assert/strict';
import {test} from 'node:test';
import {illustrateRentNim} from '../src/fiat-context.ts';
test('100 CAD at 2 CAD per NIM illustrates 50 NIM exactly',()=>{
 const v=illustrateRentNim('CAD','100.00','2');
 assert.equal(v.estimatedLuna,5_000_000);
 assert.equal(v.estimatedNim,'50');
 assert.match(v.disclaimer,/Not a live rate/);
});
test('1.25 EUR at 2 EUR per NIM illustrates 0.625 NIM',()=>{
 assert.equal(illustrateRentNim('EUR','1.25','2').estimatedNim,'0.625');
});
test('1 cent at 3 fiat units per NIM rounds to nearest Luna',()=>{
 assert.equal(illustrateRentNim('USD','0.01','3').estimatedLuna,333);
});
test('blocks zero, negative, exponent, unknown currency and excess decimal digits',()=>{
 for(const [c,a,r] of [['CAD','0','1'],['CAD','-4','1'],['CAD','2','0'],['CAD','5e3','1'],['INR','10','1'],['USD','0.001','2'],['EUR','1','0.123456789']]){
  assert.throws(()=>illustrateRentNim(c,a,r));
 }
});
test('does not silently truncate out-of-range amounts',()=>{
 assert.throws(()=>illustrateRentNim('NGN','999999999999','0.00000001'),/safe/);
});
