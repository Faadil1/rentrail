# Nimiq Mini Apps Cycle III — RentRail submission packet (draft, not submitted)

**Date:** 2026-11-10. **Category:** PAY.  
**Official submission portal:** https://miniappscompetition.com/submit  
**Official deadline:** 2026-11-11 23:59 UTC (18:59 America/Toronto).  
**Public MIT GitHub:** https://github.com/Faadil1/rentrail  
**Public non-production read-only app:** https://rentrail-operations-staging-bqetxdq5d-faadil1s-projects.vercel.app/ (READY at app SHA `f3412c2575918d2ee1297e686ba642dc91ea0130`; **latest iPhone acceptance not yet observed**).

## Suggested title
**RentRail — Monthly rent operations and verifiable NIM payment evidence**

## Short description (under 250 words; English)

RentRail is a Nimiq Pay Mini App for landlords, tenants and small property managers who need more than a wallet transfer: a clear record of which unit, month and amount a payment belongs to.

Create a property, add rental units, generate month-specific NIM payment requests with unique privacy-minimal `RR1` references, review outstanding balances and plan next-month invoices. On the tenant side, the recipient, amount and reference are visible before any payment. The wallet remains in control of private keys.

RentRail also provides independent read-only verification of **already-sent** NIM transactions. It checks recipient, amount in Luna, memo, execution, canonical block inclusion and a later macroblock through a public Nimiq mainnet history node, rather than equating a returned hash with rent being paid. Evidence links can be rechecked by another party.

On November 10, we successfully tested the core mechanism with a real, human-approved **0.005 NIM mainnet transfer**. The public node reported matching finality, and the receiving wallet owner confirmed the funds arrived.

The public demonstration edition supports rental operations and transaction verification; direct wallet transfers remain disabled in that edition while we resolve a discrepancy in Nimiq Pay's native amount display and harden recipient identity. Data stays local to the browser. RentRail is non-custodial and does not issue legal rent receipts.

**Description length:** below the official 250-word maximum.

## Demo video

A **97-second private, silent, caption-led reviewer cut** was created in the conversation using genuine iPhone recordings. It is **not yet publicly uploaded**; the full original wallet-linked private footage is not included in this repo. Obtain the wallet owner's explicit consent before posting externally. Preserve the original `0.01 NIM` native approval vs `0.005 NIM` on-chain disclosure.

**Demo URL:** [HUMAN TO PROVIDE AFTER REVIEW / SAFE PUBLIC HOSTING].

## Submission form / team

- **Team lead name or pseudonym:** [HUMAN MUST CONFIRM].
- **Team lead GitHub:** [HUMAN MUST CONFIRM; project's owner is https://github.com/Faadil1, but do not assume that is the registered competition lead].
- **Collaborators:** [CONFIRM with teammates; do not invent GitHub handles, contributions or prize splits].
- **Prize payout Nimiq wallet address:** [HUMAN MUST SELECT/APPROVE; do NOT assume the pilot receiver B is the team prize wallet].
- **Public working Mini App URL:** [USE EXACT READY DEPLOYMENT AFTER CURRENT-IPONE ACCEPTANCE].
- **GitHub repo:** https://github.com/Faadil1/rentrail
- **Category:** PAY
- **MIT license:** repository `LICENSE` exists.
- **Status:** NOT SUBMITTED; no registration portal confirmation or accepted submission PR observed.

## Evidence for judges (truth boundary)

- **217/217 synthetic automated tests** and TypeScript/Vite build passed at release code SHA.
- Exact public preview bundle at SHA above, Vercel staging READY, no send-enabled build env variables; do not claim general live wallet payment capability from this URL.
- Separate 500-Luna native-send pilot: tested on human iPhone, included mainnet transaction with correct recipient and memo; third-party **single-node** reported `FINAL_MATCHED`.
- Receiving wallet's **0.005 NIM balance confirmed by its owner**, not by an independent B-wallet screenshot.
- Native Nimiq Pay approval display rounded/misdisplayed the amount as **0.01 NIM**; 500-Luna actual amount confirmed by on-chain history node and owner. Root cause unresolved.
- No verified production tenant population or recurring collection.
- Exact public-preview iOS host acceptance and second independent RPC provider still open.

## Required go/no-go before submission

1. Verify README, license and `main` contain the complete app source (not just a draft PR).
2. Open exact public preview SHA inside Nimiq Pay and verify Wallet gate/MAINNET/public RPC and local ledger flow; **do not initiate a new payment**.
3. Ensure judges can easily test working core features without permission to move money.
4. Review/edit/upload the private demo video with explicit privacy consent; link the public clip in the portal if approved.
5. Confirm official portal login, team lead and wallet payout address, then submit through **https://miniappscompetition.com/submit**.
6. Inspect the portal's generated public submission PR; wait for actual merged/accepted status or record any review blocker. Do not call it submitted merely because the repo is public.

**Rule references:** https://miniappscompetition.com/rules ; https://miniappscompetition.com/scoring ; https://miniappscompetition.com/faq .
