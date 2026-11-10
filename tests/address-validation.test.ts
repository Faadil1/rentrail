import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isValidNimiqAddress,compactNimiqAddress,formatNimiqAddress } from '../src/address-validation.ts';

const official='NQ48 8CKH BA24 2VR3 N249 N8MN J5XX 74DB 5XJ8';
const zeroFixture='NQ07 0000 0000 0000 0000 0000 0000 0000 0000';
const badChecksum='NQ01 1111 1111 1111 1111 1111 1111 1111 1111';

test('official NQ example has a correct mod-97 checksum',()=>assert.equal(isValidNimiqAddress(official),true));
test('valid zero account fixture satisfies mod-97',()=>assert.equal(isValidNimiqAddress(zeroFixture),true));
test('all-lowercase form is accepted and normalized',()=>assert.equal(isValidNimiqAddress(official.toLowerCase()),true));
test('remove spaces but preserve normalized address',()=>assert.equal(compactNimiqAddress(official),official.replaceAll(' ','')));
test('format valid address as 4-char groups',()=>assert.equal(formatNimiqAddress(official),official));
test('structural-only fake recipient with invalid checksum is rejected',()=>assert.equal(isValidNimiqAddress(badChecksum),false));
test('single check digit tampering is rejected',()=>assert.equal(isValidNimiqAddress('NQ49'+official.slice(4)),false));
test('single payload character tampering is rejected',()=>assert.equal(isValidNimiqAddress(official.replace('8CKH','7CKH')),false));
test('invalid address cannot be formatted',()=>assert.throws(()=>formatNimiqAddress('NOT AN ADDRESS'),/checksum/));
test('reject invalid country prefix',()=>assert.equal(isValidNimiqAddress('ZZ'+official.slice(2)),false));
test('reject invalid alphabet characters',()=>assert.equal(isValidNimiqAddress(official.replace('J5XX','I5XX')),false));
test('reject too-short addresses',()=>assert.equal(isValidNimiqAddress('NQ48'),false));
test('reject empty address',()=>assert.equal(isValidNimiqAddress(''),false));
test('reject nullish input at runtime',()=>assert.equal(isValidNimiqAddress(null as unknown as string),false));
