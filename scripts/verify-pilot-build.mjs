// Dedicated pilot build attestation. No wallet operations. No recipient addresses
// are committed to GitHub. Public VITE_* variables are still present in client JS.
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';

const digest = address => createHash('sha256').update(address.replace(/\s+/g,'').toUpperCase()).digest('hex');
const recipientDigest='6375479595e25d182d7573fe169bcc720944fa02c1e61a438899fb65b2842358';
const wanted={
  VITE_ENABLE_LIVE_NIM_SEND:'smoke_test_human_approved',
  VITE_SMOKE_ALLOW_CHARGE_ID:'62b40b301f8829c113e7e5a622840450',
  VITE_SMOKE_ALLOW_AMOUNT_LUNA:'500',
  VITE_SMOKE_ALLOW_PERIOD:'2026-11',
};
for(const [key,value] of Object.entries(wanted)){
  if(process.env[key]!==value){
    console.error('G2 pilot build STOP: '+key+' is missing or changed.');
    process.exit(1);
  }
}
const receiver=process.env.VITE_SMOKE_ALLOW_RECIPIENT;
if(typeof receiver!=='string'||digest(receiver)!==recipientDigest){
  console.error('G2 pilot build STOP: receiver fingerprint mismatch.');
  process.exit(1);
}
const js=readdirSync('dist/assets').filter(f=>f.endsWith('.js'))
  .map(f=>readFileSync(path.join('dist/assets',f),'utf8')).join('\n');
if(!js.includes(receiver)||!js.includes(wanted.VITE_SMOKE_ALLOW_CHARGE_ID)){
  console.error('G2 pilot build STOP: exact receiver or opaque request ID missing in compiled JS.');
  process.exit(1);
}
console.log('PASS: exact 500-Luna recipient/period/reference build attested. Native wallet approval is still required.');
