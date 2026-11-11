# RentRail — submission hero demo, G2/G3 mainnet evidence (V1)

**Prepared:** 2026-11-10. **Deadline:** 2026-11-11 23:59 UTC (18:59 EST Gatineau).
**Status:** caption-led **97-second genuine-screen-recording reviewer video V2 rendered privately** (available as a conversation attachment, not committed/published); public nonpayment Staging **READY** at source SHA `f3412c2575918d2ee1297e686ba642dc91ea0130`; consolidated code **merged into main** via PR #14; **public-release iPhone acceptance still outstanding; official submission NOT FILED**.

## Headline — claim exactly what we have proved

**A monthly rent reference was paid through Nimiq Pay and matched independently against the Nimiq mainnet transaction.** This was a **fictional 0.005 NIM test**, not payment of actual residential rent.

Evidence components:
1. Nimiq Pay opened the RentRail Mini App inside its iOS WebView on mainnet. Prior user video: host mainnet and independently reported MainAlbatross with close heights.
2. A request for **500 Luna (0.005 NIM)** with the opaque public memo `RR1:62b40b30…` and a separately controlled receiving address B was displayed.
3. Human user tapped the native wallet confirmation. The native UI displayed **0.01 NIM** for the amount — **record this clearly as an unresolved presentation discrepancy**, do not crop away or replace the number.
4. The wallet returned a public hash `8bd75eabcd…a583888c`. In app this is **SUBMITTED_UNVERIFIED** — not rent paid.
5. A separate read-only public Nimiq RPC history node subsequently reported an executed, matching transaction: mainnet networkId **24**, value **500 Luna**, exact receiving address and opaque memo, microblock **66,504,678**, later macroblock **66,504,720**. This is **single-node-reported `FINAL_MATCHED`**, not a multi-node cryptographic attestation.
6. The wallet owner explicitly reported receiving **0.005 NIM in wallet B** on Nov 10 at approximately 11:05 EST. Classify as **USER_CONFIRMED_RECEIVER_BALANCE** — do not present as independently observed B screenshot.

## Proposed 90–105 second hero video — no fictional product footage

| Time | Real asset / shot | Caption / spoken explanation | Guardrail |
|---|---|---|---|
| 0–12 s | Real RentRail home and calendar ledger UI, capture new read-only staging | "Crypto transfers are easy to lose track of. Rent is recurring, unit-specific and month-specific." | Product hypothesis, not market statistics |
| 12–30 s | Real property+unit+monthly charge creation on nonpayment preview | "RentRail prepares an exact rent request for a specific month, with an opaque reference." | Use fictional property names only |
| 30–47 s | **Actual 01:01 EST pilot recording** of Nimiq Pay native confirmation | "A real test transfer was approved inside Nimiq Pay." | Show caption: native dialog displayed 0.01; actual on-chain value 0.005; cause unresolved |
| 47–62 s | Real captured post-wallet hash and `SUBMITTED_UNVERIFIED` screen | "A wallet hash does not mean the rent has been confirmed." | Mask full wallet addresses/hash if user does not authorize disclosure |
| 62–80 s | Real G3 read-only RPC verifier result or actual read-only audit page | "An independent public node confirmed 500 Luna, recipient, reference, execution, canonical inclusion and a later macroblock." | Say **one public node reports** finality, do not claim cryptographic light-client |
| 80–94 s | Actual B wallet balance only **if user separately supplies a consenting, redacted screenshot**. Otherwise tasteful textual card and label 'User confirmed receiver balance' | "The receiving wallet owner also confirmed 0.005 NIM arrived." | No fabricated wallet screenshot |
| 94–105 s | Native app / concise close with public GitHub URL | "RentRail helps owners and tenants connect monthly rental operations to on-chain evidence." | Do not claim production adoption or legally paid rent |

**Editing direction:** Mobile vertical screenshots shown in a clean responsive 16:9 wrapper, zoom into real UI to preserve legibility. Use original footage, no invented blockchain recording, no fabricated data, no green 'Paid' icon before proof. If the real Nimiq approval screen includes unredacted wallet identifiers, redact with permission.

## Release caveats — do not conceal

- **Native modal discrepancy:** Nimiq Pay showed **0.01 NIM** while the chain recorded **0.005 NIM**. Official provider API documents the `value` parameter in Luna, with `100,000 Luna = 1 NIM`; upstream display formatting root cause remains unverified. No second payment is needed to investigate. Report to Nimiq maintainers with private/redacted reproduction.
- Current public general RentRail preview is **read-only** and cannot offer normal users unrestricted rent payments. The only send-capable 500 Luna pilot deployment was isolated and subsequently protected by Vercel Authentication.
- Public G3 matches do not automatically credit the landlord's local rent ledger; shared payment requests are **unsigned** and cannot authenticate beneficiary ownership. Local data are not multi-user synchronized.
- `main` **now includes** the complete consolidated public RentRail app and docs after PR #14 squash merge (`804da16130d55bf91a1895592c53896af2d2d31f`). Main CI: **217/217 PASS**. Old stacked drafts were closed as superseded, with histories intact.
- No independently documented unrelated outside-user adoption yet. Do not claim any count.

## Competition submission copy — truthful current build

**Short description, draft (under 250 words):**

RentRail is a Nimiq Pay Mini App prototype that helps landlords, tenants and small property managers organize rent by property, unit and calendar month. It creates amount-specific rental requests with a unique, privacy-minimal transaction memo, tracks outstanding local invoices, handles partial payment reviews and prepares next-month obligations.

For payment verification, RentRail checks a submitted NIM transaction against a public mainnet history node: recipient, amount in Luna, memo, execution, block inclusion and a later macroblock. It never treats a returned wallet hash alone as a confirmed receipt. An independent recheck link lets another person repeat the verification.

We tested the core mechanism with a real, human-approved **0.005 NIM mainnet transfer**. A public node reported exact finality and the receiving wallet's owner confirmed the funds arrived. The general preview remains read-only while we harden recipient identity, shared ledger persistence and wallet amount presentation. RentRail does not custody funds, expose private lease data on-chain or claim to provide legal rent receipts.

**Important:** This is accurate as a prototype overview; actual competition eligibility and a public functioning PAY path must be verified against the rules. Do not present the protected one-off pilot URL as a reusable public production deployment.

## Final submission gates (in order)

1. **Resolve demo asset availability and consent:** screen recording from 01:01 and 00:37; B wallet owner's confirmation; choose what can be published.
2. **Investigate native amount formatting** without sending money; file redacted issue upstream, explain discrepancy in demo or prominently in limitations.
3. **DONE for public build:** read-only app Staging READY, no send config, distinct from authenticated pilot. **OPEN:** final native iPhone acceptance for this release SHA, any safe general PAY launch requires new review.
4. **DONE:** canonical PR #14 merged into main, README + MIT visible, main Actions green. **OPEN:** fresh real mobile host runtime on the final public release URL.
5. **DONE privately:** 97-sec silent/captioned reviewer video V2 assembled from genuine user-recorded iPhone footage and a clearly labeled data card. **OPEN:** human media consent/review and public hosting; it has NOT been submitted or published.
6. **Submit** through the official Cycle III entry point before 23:59 UTC Nov 11, capture submitted status and exact URL. **Do not infer submission success from GitHub PR draft state.**

Source docs: https://nimiq.dev/mini-apps/api-reference/nimiq-provider ; https://nimiq.dev/mini-apps/faq ; https://miniappscompetition.com/rules .
