# Cycle III submission (Pay)

**Name:** Stub
**Tagline:** The rent book, on-chain. Every month's rent, with the stub to prove it.
**Category:** Pay
**Repo:** https://github.com/Faadil1/rentrail
**Live Mini App:** _production URL_

## Description (under 250 words)

Stub is the rent book, on-chain. Each monthly payment leaves a stub the tenant can keep and the landlord can check.

Inside Nimiq Pay, a landlord creates a property and a unit, then prepares a one-time rent request or a wallet-signed recurring lease. The monthly STUB1 reference travels with the NIM transaction, linking each transfer to the right month without exposing tenants' names on-chain.

The tenant opens a receipt-style payment link, sees the amount, receiving wallet and a signature check, then approves the payment in the native Nimiq Pay interface. Stub never controls funds or private keys.

Afterward, Stub queries a public Nimiq mainnet history node for transaction execution, recipient, exact reference, amount and finality. The landlord can search recent incoming transfers to reconcile payments with the local rent ledger. A paper-inspired printable record and QR link let anyone recheck the public payment.

The signer of a wallet-signed claim is identified as the claim signer, not necessarily the blockchain sender. Similarly, a signed request verifies the receiving wallet key, not a landlord's legal identity. Stub uses local browser storage with backup export; history discovery is bounded and relies on one public node.

Designed for rent that returns every month.

_Word count: 199._

## Before submitting (human)

- [ ] Production URL works without a Vercel login, tested in Nimiq Pay on a phone
- [ ] One real payment flow recorded (0.01 NIM between two own wallets) for the demo video
- [ ] 3 to 5 real test payments from friends (consenting), count reported honestly
- [ ] Demo video 60–90 s: create request → send link → pay in Nimiq Pay → Paid ✓ → proof opens on landlord side
- [ ] Skool post + X post, links in the form
- [ ] Icon, thumbnail, 3–5 mobile screenshots
- [ ] Team lead, GitHub, payout wallet confirmed in the portal
