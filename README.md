# RentRail (working name)

**Status:** Concept selected; technical gates open · **Target:** Nimiq Mini Apps Competition Cycle III, PAY · **Deadline:** 2026-11-11 23:59 UTC.

A non-custodial rental-payment and reconciliation Mini App for both individual landlords and property managers. One shared ledger supports many buildings and units; tenants receive a simple rent request, pay using Nimiq Pay (NIM first), and see a verifiable status. The brand will change later.

> **This repository is not yet a working or submitted Mini App.** The first commit establishes the project documentation. No live wallet payment, mainnet reconciliation, Nimiq Pay host integration, or production deployment is claimed.

## Differentiation

NimBooks already supports invoices and on-chain settlement. Our distinct hypothesis is **rental-period accounting**: scheduled obligations, unit-by-unit balances, split payments, excess/duplicate detection and two-sided review. We do **not** claim this is a globally unique idea. Validate against [NimBooks](https://github.com/subimpact/nimbooks) and other rental-payment services before submission.

## Build principles

- NIM first; USDT/Polygon is a separate future integration with different matching logic.
- Nimiq Pay owns signing and user approval. Never collect a seed phrase or private key.
- A returned transaction hash means **submitted**, not **settled**.
- Match **chain + recipient + amount + public opaque period reference + on-chain execution + finality**; fail closed.
- No addresses, tenant names, unit numbers, or contract details in public transaction memo.
- Track multi-unit workflows in the domain model from day one, but prioritize one independently verified payment journey before enhancements.
- Keep demo fixtures clearly labeled and physically separated from mainnet evidence.

## Project map

| File | Purpose |
|---|---|
| [docs/PRD.md](docs/PRD.md) | Living product requirements, acceptance criteria |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Data model, state machine, trust boundaries |
| [docs/EXECUTION_PLAN.md](docs/EXECUTION_PLAN.md) | Critical path, responsibilities, implementation plan |
| [docs/EVIDENCE_LEDGER.md](docs/EVIDENCE_LEDGER.md) | Verification ledger and no-false-pass gates |
| [docs/DEMO_PLAN.md](docs/DEMO_PLAN.md) | Honest real-device demo and submission checklist |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Architectural decision records and open questions |
| [docs/CONTINUITY.md](docs/CONTINUITY.md) | Status, repo truth, handover |

## Workflow

Every consequential change goes through a feature branch and a pull request. Preferred order: plan → implement → tests → device/mainnet verification → evidence → PR review → merge. No direct pushes to `main` after the initial MIT bootstrap.

## External references

- [Official competition rules](https://miniappscompetition.com/rules)
- [Cycle III announcement](https://www.nimiq.com/blog/mini-apps-competition-cycle-3-announcement/)
- [Nimiq Mini App SDK](https://nimiq.dev/mini-apps/api-reference/nimiq-provider)
- [Load in Nimiq Pay](https://nimiq.dev/mini-apps/development/load-local-mini-app)
- [Nimiq RPC methods](https://nimiq.dev/rpc/methods/)
- [NimBooks (related work)](https://github.com/subimpact/nimbooks)

License: [MIT](LICENSE).