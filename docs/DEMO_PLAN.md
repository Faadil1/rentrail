# Hero demo + submission plan — Cycle III

**Demo must be captured from the real deployed app, not generated product footage.** Target 90–120 sec for standard project walkthrough. A separate 3–5 minute version may be needed for an optional live community Demo Day slot; do not claim registered.

## Storyboard (time budget provisional)
- **0–12s — Hook:** “A transfer isn't a rent ledger.” Show unit-specific period and balance, clearly distinguishing obligations from blockchain evidence.
- **12–28s — Landlord / manager:** create or select a property with two units; create a November rent obligation.
- **28–45s — Tenant:** open opaque request in Nimiq Pay, check payment recipient, exact NIM amount and period. No PII in the public memo.
- **45–66s — Native wallet:** user authorizes a small controlled *real* NIM transfer only if owner has approved. Never trigger unscripted payments. Show SUBMITTED, not paid.
- **66–90s — Independent verification:** show hash, canonical transaction details and macroblock finality. Reveal PAID_ONCHAIN_VERIFIED or PARTIALLY_FUNDED **only if real evidence exists**.
- **90–110s — Depth:** show second unit and exception (wrong memo/duplicate) clearly labeled as a deterministic demonstration; no fake mainnet footage.
- **110–120s — CTA:** mainnet link, public MIT GitHub, 'try in Nimiq Pay', real feedback invitation.

If live chain verification is missing, demo must say so and cannot imply a functional prize-ready finance product.

## Submission requirements
- [ ] Final, collision-checked public product name.
- [ ] Nimiq Mini App fully usable from an HTTPS URL inside Nimiq Pay.
- [ ] At least one NIM or USDT payment integration performing a core job.
- [ ] Public repo under MIT; exact commit SHA linked in evidence.
- [ ] App/category PAY chosen; short description <=250 words verified.
- [ ] Screenshots from real deployed app; no generated or altered 'live' screenshots.
- [ ] Demo video link optional under official rules but recommended.
- [ ] Real users tested, feedback with consent, no invented unique counts.
- [ ] Submission made using official registration dashboard, receipt/PR evidence saved.
- [ ] Human sign-off before mainnet action or promotion.

## Description draft (pre-submission, revise only after completed)
“RentRail (working name) turns Nimiq Pay transfers into period-specific rent records. Tenants receive a clear NIM payment request showing the intended recipient, amount and month, then authorize a transaction in their wallet. Landlords and property managers organize buildings and units, track open and partially funded periods, and independently reconcile transfers to an opaque public reference. We display unknown and unfinalized states instead of equating a submitted hash with payment. Rental terms and identity remain off-chain. Our goal is practical, non-custodial rental administration—one unit or many—using Nimiq Pay as the payment layer.”

**This draft describes intended features; it is NOT approved to submit until those features exist.**

References: https://miniappscompetition.com/rules · https://miniappscompetition.com/scoring