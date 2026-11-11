import assert from 'node:assert/strict';
import {test} from 'node:test';
import {compareIndependentRecipient} from '../src/recipient-crosscheck.ts';

const address='NQ07 0000 0000 0000 0000 0000 0000 0000 0000';
test('independent recipient comparison matches case and whitespace safely',()=>{
 const r=compareIndependentRecipient(address,address.replaceAll(' ','').toLowerCase());
 assert.equal(r.state,'MATCH');
 assert.match(r.message,/does not prove/);
});
test('rejects malformed independent NQ recipient',()=>{
 assert.equal(compareIndependentRecipient(address,'NQ00 fake').state,'INVALID');
});
test('rejects an invalid request NQ address',()=>{
 assert.equal(compareIndependentRecipient('NQ00 INVALID',address).state,'INVALID');
});
test('different syntactically plausible recipients never return MATCH',()=>{
 assert.notEqual(compareIndependentRecipient(address,'NQ21 1111 1111 1111 1111 1111 1111 1111 1111').state,'MATCH');
});
