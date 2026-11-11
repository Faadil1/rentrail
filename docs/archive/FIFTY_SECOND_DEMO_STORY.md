# RentRail — 50-second judge walkthrough, real workflows only

**Goal:** a new judge should understand the use case *before* encountering chain terminology. This is a capture plan; **not a finished or published video**.

| Timeline | User-visible action | Voiceover / caption | Integrity gate |
|---|---|---|---|
| 00–07 | Open the guided Overview, choose **I manage rentals** | "A NIM transfer doesn't tell a landlord which unit or month was paid." | Pain statement, not invented adoption statistics |
| 07–15 | Choose **Show me RentRail**, launch the clearly fictional portfolio | "RentRail organizes buildings, units and recurring rent requests." | Fictional example explicitly labeled |
| 15–23 | Click **Rent requests**, show month, NIM amount and opaque RR1 memo | "Every rent month has a unique reference and a visible recipient." | Link remains unsigned; do not claim authenticated identity |
| 23–31 | Click **Collections**; show dates, aging and a manually copyable draft | "Review what's due, what's missing and what needs a human check." | Local overdue != legally delinquent |
| 31–40 | Choose **I pay rent → Verify my transaction**; show the read-only four-field form | "Tenants can review an already-sent payment without connecting their wallet." | Do not paste the private pilot wallet/hash into a public capture without explicit owner consent |
| 40–50 | Reuse the **real, permission-approved** pilot footage and a text evidence card | "In our controlled 0.005 NIM test, one mainnet node reported an exact final match; the recipient confirmed receipt." | Actual receiver B was user-confirmed, not separately authenticated; native Nimiq Pay amount screen showed **0.01 NIM** because of a likely upstream two-decimal display issue |

**On-screen headline:** "Know which rent. Know which payment."

**Call to action:** "Try the read-only guided preview. No wallet funds required."

**Do not say:** “RentRail processes all rental payments,” “tenant identity is verified,” “payments are fully automatic,” “confirmed legal rent settlement,” “our 25 users,” or “Nimiq has fixed the small-amount display” (none is established).

**Release verification:** capture the exact deployed SHA in an iPhone Nimiq Pay WebView before publishing the new UI footage. The older 97-second private review video does not by itself prove this new frontend build was tested.

**Status:** storyboard approved as a *working production plan* but not human publication consent, not a final video, not the official hackathon submission.
