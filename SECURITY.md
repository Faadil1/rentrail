# Security and privacy — development policy

RentRail is a financial workflow prototype under development. **Do not use it to settle real rent until it has been independently tested, reconciled and reviewed for your jurisdiction and contract.** Current repository has only documentation; no usable Mini App.

## Reporting
Please open a private security advisory on the repository if supported. Otherwise contact the repository maintainer through a private channel; do not publish wallet secrets or exploitable vulnerability details in issues.

## Financial authority
- Non-custodial: only the Nimiq Pay host prompts and executes user-approved payments.
- No private keys, seed phrases, passwords or custodial APIs are requested, stored or logged.
- A transaction hash or wallet confirmation alone does not establish finality.
- Payment matching requires independent chain checks; inaccurate/ambiguous records fail closed.
- A 'verified on-chain' transfer does not certify fulfillment of a legal tenancy contract.

## Privacy
- Do not put tenant names, full property addresses, apartment numbers, lease documents, phone numbers, emails or identity numbers in blockchain data or public links.
- Public memo is strictly an opaque random request reference, <=64 UTF-8 bytes.
- Any future backend must add threat modeling, data processing notice, consent, retention policy and authenticated authorization before holding private records.
- Never place API credentials in public repository, frontend bundle or CI logs.

## Prohibited test practices
No automated real-money transfers, fake green chain confirmations, mined/fabricated mainnet receipts, non-consensual tenant testing or trying to recover private keys. Use synthetic fixtures only with visible `DEMO` or `TEST` labels.

## Known design limits
No verified real payment flow; no cross-device authenticated sync; no verified legal/accounting compliance; RPC uptime/finality and Nimiq Pay iOS support must be observed in actual runtime before claims.