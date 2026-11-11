# Cycle III submission (Pay)

**Name:** RentRail
**Tagline:** Rent requests paid in NIM, confirmed on-chain.
**Category:** Pay
**Repo:** https://github.com/Faadil1/rentrail
**Live Mini App:** _production URL_

## Description (under 250 words)

RentRail turns rent into a monthly flow that only Nimiq Pay makes possible.

There are no accounts: landlords and tenants sign in with their Nimiq Pay wallets. A landlord adds properties and units, then signs a monthly lease once with their wallet. RentRail creates each month's request, with a unique RR1 reference that travels in the Nimiq transaction itself.

The tenant opens the link in Nimiq Pay. RentRail verifies the landlord's signature: a modified link blocks payment, and a new receiving address triggers a warning. The tenant taps Pay and approves in the native Nimiq Pay sheet. RentRail never holds funds or keys. It then confirms the transfer on Nimiq mainnet (recipient, amount, reference, execution, finality) and shows Paid, a PDF receipt with QR code, and a proof signed by the tenant's wallet.

The landlord's ledger detects incoming payments automatically, matches them to each unit and month, and shows who paid, who partly paid and who is late. Each payment counts once; payments from an unknown wallet are flagged. Every new month appears on both sides without a new link.

Non-custodial and serverless: data stays on each device, with backup export.

While testing, we found that the Nimiq Pay confirmation sheet rounds amounts to 2 decimals, so RentRail keeps every request at 2 decimals.

For landlords, small property managers and tenants who pay rent every month.

## Before submitting (human)

- [ ] Production URL works without a Vercel login, tested in Nimiq Pay on a phone
- [ ] One real payment flow recorded (0.01 NIM between two own wallets) for the demo video
- [ ] 3 to 5 real test payments from friends (consenting), count reported honestly
- [ ] Demo video 60–90 s: create request → send link → pay in Nimiq Pay → Paid ✓ → proof opens on landlord side
- [ ] Skool post + X post, links in the form
- [ ] Icon, thumbnail, 3–5 mobile screenshots
- [ ] Team lead, GitHub, payout wallet confirmed in the portal
