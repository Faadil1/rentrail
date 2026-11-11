# RentRail — Cycle III submission and clarity pack

**Prepared:** November 10, 2026. **Category:** PAY. **Status:** draft until the official portal confirms receipt.

## The 5-second value proposition

**Know which rent. Know which payment.**

RentRail helps landlords and tenants organize monthly rent requests, understand what is still being reviewed and check whether an existing NIM transfer matches a particular rental month. Nimiq powers the payment evidence, not a claim of legal settlement.

## Paste-ready official description (under 250 words)

RentRail brings monthly rental operations into Nimiq Pay.

A wallet transfer alone does not tell a landlord which apartment or rental month it belongs to. RentRail organizes properties, units, recurring rent requests and due dates, then links each request to an opaque on-chain payment reference. Owners can prepare a new month's requests, review open items, draft follow-ups and export a privacy-conscious report. Tenants can read a shared request and independently check an already-completed NIM transfer using its hash, recipient, amount and reference.

The app distinguishes a request, a submitted hash, a transaction that one public mainnet node reports as matched, and an exception needing review. Partial matches remain partial. A controlled 0.005 NIM mainnet pilot was completed and the receiving wallet holder confirmed receipt.

The public competition preview intentionally does not initiate transfers: a Nimiq Pay small-amount confirmation-display discrepancy remains unresolved. Records currently live in the browser; request links are unsigned, identities are not authenticated and a blockchain match is not a legal rent receipt.

RentRail's aim is simple: make recurring Nimiq payments easier to organize, explain and check for real-world rental use.

## Demo: judge-first walkthrough (50 seconds, only real footage)

| Seconds | Action | Message |
| --- | --- | --- |
| 0–7 | Show headline and select landlord | “A transfer alone doesn't say which rent it covers.” |
| 7–16 | Open fictional example, properties and rent requests | “Organize buildings, units and monthly requests.” |
| 16–25 | Show dates and outstanding review | “Know which months need attention, without claiming someone failed to pay.” |
| 25–35 | Select tenant and open **Check payment**, read-only form first | “Verify an existing payment without connecting a wallet.” |
| 35–44 | Show honest status explanations | “A hash is not proof, and a partial payment is not a full match.” |
| 44–50 | Use real pilot evidence *only with owner consent* | “A user-approved 0.005 NIM mainnet pilot succeeded; public sending stays disabled while display precision is unresolved.” |

**Never invent live payment footage, unique users, cross-device sync or signed landlord identities.** Do not display private pilot addresses/hashes or recordings without permission.

## Manual iPhone Nimiq Pay acceptance — must be executed, not assumed

1. Open the exact latest staging URL **inside Nimiq Pay**. Record device, URL, SHA and date.
2. On first view, read the headline and select **Show me RentRail**; no accounts, payments or real data required.
3. Open fictional properties, a monthly request and **Due dates**; inspect text clipping, horizontal scroll, touch targets and month labels.
4. Switch to **I pay rent → Check payment**: read-only verifier must come **before** wallet diagnostics, and invalid data must yield a clear error.
5. Confirm the interface never says an open local request is legally “unpaid”, a hash proves receipt, or a node match settles a lease.
6. Verify no user-facing public send button initiates a NIM transfer; no old 0.005 NIM pilot is repeated.
7. If any step fails, capture the exact screen and don't mark mobile PASS.

## Release and submission gates

- [ ] PR #17 reviewed and merged to main after iPhone acceptance.
- [ ] PR #18 reviewed and merged after #17, then reconcile this clarity PR as needed.
- [ ] Current PR CI/test/build verified on **its own final SHA**; previous 260-test proof applies to the earlier guided preview, not automatically this change.
- [ ] Final exact deployment READY and iPhone WebView inspected; do not promote production automatically.
- [ ] Competition form completed through https://miniappscompetition.com/submit (team lead, public URL, category, repo, written description, optional video and payout wallet).
- [ ] Confirmation from competition submission/dashboard or merged official competition entry independently inspected.
- [ ] Only report external test users if evidence exists; the single 0.005 NIM controlled pilot is not a user-adoption count.

## Beyond Cycle III — maximal product depth in sensible order

1. **Trust and shared workspace**: authenticated invitations, signed month-specific requests, recipient address ownership proof, scoped roles, consent and privacy.
2. **Real reconciliation**: multiple transfers per charge, persistent audit history, deduplication across devices, recheck finality, excess/credits and dispute workflow.
3. **Real tenancy operations**: property/unit state, move-in/out, scheduled rent changes, proration, month close, exports, dispute evidence.
4. **Real-currency context**: explicit local-currency rent reference, source/timestamp for rate quotes, bounded price expiry and clear NIM/fiat difference.
5. **Safe native PAY**: wallet UI precision fix verified upstream, recipient confirmation, exact transaction approval, rate/amount safety gates and human consent.
6. **Adoption**: external landlord–tenant task tests, comprehension funnel and honest retention measurements.

Do not represent future roadmap bullets as features shipped in the current competition preview.
