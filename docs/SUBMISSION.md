# Cycle III submission (Pay)

**Name:** RentRail
**Tagline:** Rent requests paid in NIM, confirmed on-chain.
**Category:** Pay
**Repo:** https://github.com/Faadil1/rentrail
**Live Mini App:** _production URL_

## Description (under 250 words)

RentRail turns monthly rent requests into verifiable NIM payment workflows inside Nimiq Pay.

Landlords and small property managers create properties and units, then prepare one-off requests or wallet-signed monthly leases. Each month receives an RR1 payment reference. A tenant opening the link can inspect the NIM amount and recipient, verify the signature when supported, and explicitly approve payment in Nimiq Pay. No keys or funds pass through RentRail.

After the wallet returns a transaction hash, RentRail asks a public Nimiq mainnet history node to check the recipient, exact reference, amount, execution and finality. It distinguishes pending, partial, matched and uncertain transfers. Owners can search recent incoming transactions against their locally recorded requests and export or back up their records. A printable payment record includes a QR link for independent rechecking.

A tenant may sign a claim linking their wallet to a payment hash. That signature identifies the claim signer, not necessarily the actual blockchain sender. Similarly, a signed rent request proves control of the receiving wallet key, not legal ownership of the property.

The app is non-custodial and browser-local. Recent-transaction discovery is limited and uses one external history node; mobile signing and payments require verification in Nimiq Pay. NIM is supported now; USDT is a future extension.

_Word count: 207._

## Before submitting (human)

- [ ] Production URL works without a Vercel login, tested in Nimiq Pay on a phone
- [ ] One real payment flow recorded (0.01 NIM between two own wallets) for the demo video
- [ ] 3 to 5 real test payments from friends (consenting), count reported honestly
- [ ] Demo video 60–90 s: create request → send link → pay in Nimiq Pay → Paid ✓ → proof opens on landlord side
- [ ] Skool post + X post, links in the form
- [ ] Icon, thumbnail, 3–5 mobile screenshots
- [ ] Team lead, GitHub, payout wallet confirmed in the portal
