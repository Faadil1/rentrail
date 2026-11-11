# Cycle III submission (Pay)

**Name:** RentRail
**Tagline:** Rent requests paid in NIM, confirmed on-chain.
**Category:** Pay
**Repo:** https://github.com/Faadil1/rentrail
**Live Mini App:** _production URL_

## Description (under 250 words)

RentRail turns rent into a clear monthly flow inside Nimiq Pay.

Landlords and small property managers add their properties and units, then create a rent request per unit and month: amount in NIM, receiving address, and a unique RR1 reference (no names go on-chain). They send the link to the tenant and see, month after month, who has paid, who partly paid and who is late. One tap rolls every request over to next month.

Tenants open the link in Nimiq Pay, check the month, amount and landlord address, and tap Pay. Nimiq Pay shows its native confirmation; RentRail never holds funds or keys. RentRail then reads Nimiq mainnet until the transfer is final, matching the exact recipient, amount, reference, successful execution and macro-block finality, and shows Paid with a proof link.

When the landlord opens that proof link, RentRail checks it live on mainnet and marks the month paid in their ledger. A transaction can only count once, partial payments add up, and overpayments are flagged.

Non-custodial, no backend, no account. The ledger stays on the landlord's device with backup export.

While testing we found that the Nimiq Pay confirmation sheet rounds amounts to 2 decimals, so RentRail keeps every request at 2 decimals and the sheet always shows the exact rent.

Built for the payment people make every month.

_Word count: 226._

## Before submitting (human)

- [ ] Production URL works without a Vercel login, tested in Nimiq Pay on a phone
- [ ] One real payment flow recorded (0.01 NIM between two own wallets) for the demo video
- [ ] 3 to 5 real test payments from friends (consenting), count reported honestly
- [ ] Demo video 60–90 s: create request → send link → pay in Nimiq Pay → Paid ✓ → proof opens on landlord side
- [ ] Skool post + X post, links in the form
- [ ] Icon, thumbnail, 3–5 mobile screenshots
- [ ] Team lead, GitHub, payout wallet confirmed in the portal
