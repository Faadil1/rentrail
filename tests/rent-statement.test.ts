import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createRentStatement,encodeRentStatement,decodeRentStatement,rentStatementUrl} from '../src/rent-statement.ts';
import type {SharedRequest} from '../src/domain.ts';
const id='a'.repeat(32),h1='1'.repeat(64),h2='2'.repeat(64),recipient='NQ48 HR14 MN5P GHYP YTL4 E2PN SHYK 35UA E1QT';
const request:SharedRequest={v:1,chargeId:id,memo:'RR1:'+id,recipient,amountLuna:1000,period:'2026-11'};
test('two-hash public statement encodes and decodes without private unit labels',()=>{
 const stmt=createRentStatement(request,[h1,h2]);
 const data=encodeRentStatement(stmt);
 assert.deepEqual(decodeRentStatement(data),stmt);
 assert.equal(JSON.stringify(stmt).includes('Unit'),false);
});
test('statement shows version 2 and only public invoice tuple',()=>assert.equal(createRentStatement(request,[h1]).v,2));
test('zero claims cannot be misleadingly shared as a verified statement',()=>assert.throws(()=>createRentStatement(request,[]),/1–8/));
test('reject more than 8 hashes',()=>assert.throws(()=>createRentStatement(request,Array(9).fill(h1)),/1–8/));
test('duplicate hash refused even if case differs',()=>assert.throws(()=>createRentStatement(request,[h1,h1.toUpperCase()]),/Repeated/));
test('bad hash refused',()=>assert.throws(()=>createRentStatement(request,['bad']),/Invalid/));
test('invalid RR1 memo refused',()=>assert.throws(()=>createRentStatement({...request,memo:'tenant=john'},[h1])));
test('wrong period refused',()=>assert.throws(()=>createRentStatement({...request,period:'2026-99'},[h1])));
test('reject malformed base64',()=>assert.throws(()=>decodeRentStatement('@bad#')));
test('reject oversize public URL bundle',()=>assert.throws(()=>decodeRentStatement('a'.repeat(2501))));
test('reject alternate statement version on decode',()=>{
 const data=btoa(JSON.stringify({v:1,request,hashes:[h1]}));
 assert.throws(()=>decodeRentStatement(data),/Unsupported/);
});
test('reject missing hashes array on decode',()=>{
 const data=btoa(JSON.stringify({v:2,request}));
 assert.throws(()=>decodeRentStatement(data),/Missing/);
});
test('reject HTTP to avoid leaking public tenant payment metadata in transit',()=>{
 const stmt=createRentStatement(request,[h1]);
 assert.throws(()=>rentStatementUrl('http://example.org','/',stmt),/HTTPS/);
});
test('reject open-redirect pathname',()=>assert.throws(()=>rentStatementUrl('https://example.org','//attacker.com',createRentStatement(request,[h1]))));
test('public statement URL includes only a data parameter and HTTPS',()=>{
 const url=rentStatementUrl('https://example.org','/',createRentStatement(request,[h1,h2]));
 assert.equal(new URL(url).searchParams.has('statement'),true);
 assert.equal(new URL(url).searchParams.has('pay'),false);
});
