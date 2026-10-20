# Quota to Cash: 14-day paid-demand validation workflow

**Prepared:** October 20, 2026 · **Timezone:** Asia/Singapore · **State:** preparation only

**Availability:** This workflow is on the development branch after `v0.1.0`. Use `main` for its commands; the existing tag and Release assets remain unchanged.

The decision is whether one narrow catalog-data job deserves a paid pilot. An AI executor owns research, qualification, follow-up, sample preparation, delivery checks and reporting. The operator has no daily task allocation. Actual customers still need to supply authorized data, decide whether to buy and use the output. Account-owner identity checks, if required by a platform, remain external blockers.

This package prepares the workflow. Its local commands do not send messages, run cloud jobs, activate pricing or schedule future work. The campaign's execution, outbound, spending and scheduling switches all default to `false`. No recurring automation was created.

## What the research supports

The [source-linked research dataset](../examples/commercial-validation/research.json) contains **25 research candidates**: 14 organizations and 11 public demand signals from 9 topic threads. The three signals from one supplier-spreadsheet discussion remain separate respondents but one topic. None is a verified buyer, qualified prospect, consenting contact or paid customer. Publication dates and product gaps are retained; old threads are historical evidence.

The first organizations to investigate are **Enhance Tech Solutions**, **Makeitfuture** and **Datamagnet**. Their published services overlap catalog mapping, feed cleanup or e-commerce data pipelines. That makes them possible delivery partners or tool users; it also makes them potential competitors. Public contact details and an “accepting clients” label do not establish procurement intent or permission for automated marketing. [Enhance profile](https://apify.com/partners/find/enhance-tech-solutions), [Makeitfuture service](https://www.makeitfuture.com/ai-agents/product-enhancement), [Datamagnet profile](https://apify.com/partners/find/datamagnet)

Recent first-person demand includes supplier SKU/Handle lookup, inconsistent spreadsheet fields, product entry and typed product attributes. A [September supplier-spreadsheet discussion](https://community.shopify.com/t/how-do-you-handle-supplier-spreadsheets-when-updating-your-store/676989) and a [retailer import question](https://community.shopify.com/t/product-import-integration-for-pos-retailers/687184) motivate the questions below. They do not establish that a generic JSON normalizer is something those users will buy. Several needs require CSV/XLSX ingestion, joins, diffs or Shopify writes beyond v0.1.0.

There is a low-cost substitute to beat: n8n already provides [field mapping](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.set/) and [duplicate removal](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.removeduplicates/). The commercial hypothesis is saved review and maintenance effort through a repeatable mapping and acceptance evidence, rather than merely performing a trim or dedupe operation.

Read the [candidate shortlist](commercial/LEAD_SHORTLIST.md) for all 25 records and their source links, fit limits and contact restrictions.

## Buyer, offer and scope

**First buyer hypothesis:** an existing Apify user, or an agency delivering an Apify/n8n/Make catalog pipeline, who repeatedly repairs inconsistent product records and can choose a small paid tool. Verify the buyer's actual platform setup, current workaround, frequency and authority; expertise-directory membership alone does not prove a paid Apify account.

**Customer-facing offer hypothesis:** “Make one recurring catalog feed predictable: agree the input and target fields, reproduce the cleanup rules, and inspect the result before connecting it downstream.” Sell the data-processing outcome. The Quota to Cash name describes the creator experiment, not a customer earnings promise.

| Scope | Available or proposed |
| :--- | :--- |
| Fixed JSON catalog input, primitive fields, deterministic type conversion, trimming, casing, within-batch dedupe and sorting | Current trusted runtime; reviewed ToolSpec and fixed fixtures required |
| Up to 10,000 records and 32 flat fields | Current runtime ceiling, not a validated throughput promise |
| Reusable mapping for a different customer feed | Generate and validate a separate specification; the public fixed example is not a universal mapping UI |
| CSV adapter or row-level exception report | Proposed; build at most one repeatedly requested improvement after sample evidence |
| SKU-to-Handle lookup, joins, variant logic, full Shopify import, inventory writes, PDF extraction or enrichment | Excluded from the first offer unless separately scoped, implemented and tested |

The current capabilities are defined by [the runtime](../src/runtime.mjs) and [example contract](../examples/catalog.json). The AI executor must not publish unimplemented capabilities in a Store listing.

## Acquisition under the no-operator constraint

| Priority | Channel | Prepared AI action | Entry condition |
| :--- | :--- | :--- | :--- |
| 1 | Own Apify Store listing | Prepare outcome-specific title, input/output examples, limits, pricing explanation and self-serve test | Authorized account, tested build and verified listing/pricing controls |
| 2 | Own GitHub repository | Prepare a product-use page, reproducible examples, integration template and opt-in sample request | Publish only owned content; request public/sanitized samples, never customer secrets |
| 3 | Apify MCP / agent discovery | Check searchable description and schemas using search/detail tools; produce an integration example | Discovery is not customer usage; self-tests are excluded from sales |
| 4 | Downstream Actor integrations | Prepare a scraper-output-to-normalizer example | Verify actual interface and directory submission requirements |
| 5 | The 14 agency candidates | Prepare one specific partnership hypothesis and qualification question per organization | Contact only through a verified, permitted business channel with an authorized sender; otherwise keep queued |
| Research only | n8n, Make and HN community threads | Read problems and code objections into product hypotheses | No autonomous posting or promotional replies |

The [n8n announcement](https://community.n8n.io/t/this-forum-is-for-humans-by-humans/305091) requires human understanding and involvement; [Make rules](https://community.make.com/t/make-community-dos-and-donts/5) prohibit automated content. [HN guidelines](https://news.ycombinator.com/newsguidelines.html) exclude automated posting. These channels are not an outbound path for this fully autonomous plan.

GitHub permits project-related promotion in an owner's README, while prohibiting advertising on other users' accounts and unwanted mail based on harvested user information. [GitHub AUP](https://docs.github.com/en/site-policy/acceptable-use-policies/github-acceptable-use-policies) Apify supports [MCP discovery](https://docs.apify.com/mcp) and [Actor integrations](https://docs.apify.com/integrations/actors); discovery or inclusion is not guaranteed. The campaign keeps Actor payment inside Apify and avoids off-platform service promotion in Store content. [Store publishing terms](https://docs.apify.com/legal/store-publishing-terms-and-conditions)

All 25 initial candidates are research records. **Zero are pre-authorized for automatic contact.** For owned inbound requests, the customer can explicitly opt into an AI-led sample conversation. Do not turn an unknown channel policy, archived question or public profile into contact permission.

## Readiness and activation contract

Day 0 is the research package dated October 20. The suggested Day 1–14 window is **October 21–November 3, 2026**, only if activation conditions are met. These are proposed dates, not a running schedule. Shift the full window if readiness takes longer; no paid-demand inference is valid while the payment path is unavailable.

Before a future executor activates the campaign, it must record:

1. An authenticated owner-controlled inbound/outbound route and any required consent or channel permission; all forum-only records remain research-only.
2. A deployed offer whose actual features match its examples and independent fixtures, plus successful exact-build cloud checks.
3. Effective PPE prices, charge limits, billing setup and a way to distinguish eligible external usage from tests. Public Actor metadata alone does not prove this setup.
4. Payout/KYC readiness if the experiment is meant to establish cash receipts. Platform-required owner verification cannot be fabricated or completed by impersonation. [Payout requirements](https://docs.apify.com/actors/publishing/monetize/monthly-payouts)
5. Real attribution and evidence collection. Owner-visible run lists and public run totals are incomplete; unidentified traffic remains unattributed.
6. A durable executor and persistence/notification mechanism. This repository currently provides an offline preparation workflow, not a deployed sales agent.

Research and drafting can continue while a condition is unknown. Sending, charging and scheduling stay disabled. The current request authorizes preparation and GitHub publication of the package, not campaign activation.

## The 14-day queue

All tasks below are owned by AI. Conversations are asynchronous and opt-in; targets are experiment goals, not forecast conversions.

| Day | Suggested date | AI work | Required evidence / checkpoint |
| :--- | :--- | :--- | :--- |
| 1 | Oct 21 | Check account, offer, charging, attribution and channel readiness | Save observed states; unresolved essential gates mean `not_launched` |
| 2 | Oct 22 | Prepare owned intake page, sample instructions and fixed-price offer | One reproducible customer journey; no production data in public issues |
| 3 | Oct 23 | Prepare Store-search and MCP discovery examples; qualify the 25 records | Distinguish prospects, partners, historical signals and competitors |
| 4 | Oct 24 | Conduct opt-in asynchronous qualification; seek 10 substantive responses | Actual task, frequency, last failure, current workaround and paid-plan fit |
| 5 | Oct 25 | Seek 3 authorized samples with independently specified expected outputs | Source authorization and acceptance criteria; samples are not sales |
| 6 | Oct 26 | Choose one repeated, narrow need; implement at most one missing capability | At least 2 independent sample owners need the same improvement, or use existing scope |
| 7 | Oct 27 | Reproduce sample outputs and package a limited pilot | Fixtures pass; tests/build/charging checks are separate |
| 8 | Oct 28 | Present the same disclosed price to qualified sample owners | Record quote shown and acceptance/rejection; quote acceptance is not payment |
| 9 | Oct 29 | Support customer-operated runs and inspect delivered results | Independent external user, successful delivery and attributable paid evidence |
| 10 | Oct 30 | Review attempts, failures and costs; make a second opt-in qualification pass | No more than one permitted follow-up per unanswered contact; stop on opt-out |
| 11 | Oct 31 | Invite opted-in users to process a genuinely new batch | Repeat must be new work, not rerunning a demo or retrying a failed job |
| 12 | Nov 1 | Compare repeated usage with the first delivery; collect objections | New input, different day, paid eligible use; count unique customers |
| 13 | Nov 2 | Reconcile charges, reversals, platform costs and AI consumption | Separate delivered work, charged usage, settled earnings and cash |
| 14 | Nov 3 | Produce a result by source/channel and choose continue/revise/stop/inconclusive | Include zero-income outcomes and incomplete evidence |

The [campaign configuration](../examples/commercial-validation/campaign.json) is the machine-readable queue. The [outreach templates](commercial/OUTREACH_TEMPLATES.md) are drafts with channel conditions, not sent messages.

## Price and evidence definitions

Keep the first published price constant throughout the experiment: **$0.01 per start + $0.002 per successfully delivered record**. These are existing project hypotheses, not activated prices. Do not charge the same delivered record through two events. Read the effective tier configuration before quoting; a customer cap must be respected.

| Delivered records, one run | Hypothetical charge | 80% before applicable platform cost |
| ---: | ---: | ---: |
| 100 | $0.21 | $0.168 |
| 1,000 | $2.01 | $1.608 |
| 10,000 | $20.01 | $16.008 |

These are calculations, not observed revenue or margin. Apify's current formula is `0.8 × eligible event revenue − platform costs`; free-plan usage does not contribute creator profit under that calculation. [Pricing and costs](https://docs.apify.com/actors/publishing/monetize/pricing-and-costs)

Count four separate evidence stages:

1. **Delivery:** a real outside user receives usable results, including free trials.
2. **Recorded eligible paid usage:** attributable, independently funded customer work on a paying account, positive actual charges and delivered records; exclude owner runs, coupons/sponsorship supplied by the project, refunded work and synthetic tests. Unknown eligibility remains unknown.
3. **Platform settlement:** platform evidence of the actual earnings basis, with reversals and deductions retained.
4. **Cash receipt:** supporting payment evidence of cash actually received. Keep raw payment records private; source references are not a bank audit.

For a stronger continuation signal, each of 3 independent customers should purchase at least one meaningful batch of roughly 1,000 records (about $2.01 under this quote), with at least one paid batch on different input at least 24 hours later from one customer. Even meeting this small threshold only supports another experiment. Three token payments do not establish a business. The CLI reports recorded event counts and never independently certifies payment.

Apify invoices prior-month profit on the 11th and generally issues payouts on the 21st–25th, subject to verification, thresholds and adjustments. Thus 14 days can establish paid demand without establishing cash receipt. [Payout schedule](https://docs.apify.com/actors/publishing/monetize/monthly-payouts) The docs list Wise alongside PayPal at $20, while current Store terms specify PayPal $20 and other methods $100; record the actual Console method instead of resolving that discrepancy by assumption.

## Decision rules

The original targets remain **25 research candidates → 10 substantive conversations → 3 authorized samples → 5 self-serve trials → 3 unrelated paying customers → 1 genuine repeat customer**. Seek samples from 3 independent contributors and trials from 5 independent customers; several files or runs from one person do not fill those participant targets. They are goals, not an estimated funnel. Organic-only access under this autonomy constraint may produce fewer opportunities.

| Observation | Decision |
| :--- | :--- |
| 3 independently funded paying customers, at least 1 later paid batch, correct billing/delivery and measurable positive incremental contribution | Continue a narrowly scoped paid pilot; wait for settlement before claiming cash profit |
| Fewer than 20 attributable, relevant visitors or fewer than 5 qualified users actually shown the price | `inconclusive_acquisition`; revise discoverability or permitted channels; do not declare no demand |
| At least 20 attributable qualified visitors and 5 qualified offer exposures, reliable delivery, but no purchases | `revise_offer_or_price`; inspect recorded objections before building more features |
| Purchases but no usable output, no repeat or negative incremental contribution | Fix delivery/economics and retest; do not scale marketing |
| Payment readiness, identity or channel permission remains unavailable | `not_launched` or `blocked`; preserve drafts and the unfinished stage |
| Opt-out, channel restriction, misleading listing or billing/delivery mismatch | Stop the affected route immediately; retain failure evidence |

No ads, paid list purchases or cloud jobs are authorized in preparation mode. A future execution budget must separately cap incremental spend and account for AI/provider consumption, builds and support; unknown dollar consumption is not zero. Do not extrapolate the two tiny historical cloud checks to batch economics. Reconcile net settlements without subtracting the same platform deductions twice.

## Run the offline workflow

```sh
node --run commercial:check
node --run commercial:plan
node --run commercial:status
```

The empty [evidence example](../examples/commercial-validation/evidence.example.json) deliberately records no conversations, samples, trials, charges or receipts. For future privately stored evidence, use the CLI's `--evidence` option; do not commit customer identities, production inputs, payment records or raw messages. The local `research/` and `release/` directories remain outside published source.

```sh
node scripts/commercial.mjs status --evidence ./research/private-campaign-evidence.json
```

That optional file uses `{ "version": 1, "events": [] }`. Each real event requires a unique `id`, an `eventType`, an ISO `occurredAt` timestamp with timezone, a pseudonymous `customerRef` and a private `evidenceRef`. Supported types are `qualified_visit`, `qualified_conversation`, `sample_authorized`, `trial_delivered`, `quote_presented`, `eligible_paid_usage`, `platform_settlement` and `cash_receipt`. Event labels and references remain self-recorded evidence; validation is not independent verification of a customer or payment.

Paid stages additionally require `independentCustomer`, `payingPlan` and `customerWork` to be true; `ownerRun`, `sponsored` and `refunded` to be false; positive `chargesUsd` and integer `deliveredRecords`; and distinct `runRef` plus an `inputRef`. Settlement and cash rows add positive `amountUsd` and match an existing eligible-usage row. Cash also requires a recorded earlier settlement and cannot exceed its amount. The lightweight format allocates financial evidence to one run per row; it does not automatically reconcile a monthly multi-run invoice.

Duplicate event IDs or run references within one stage fail validation. Visits and quoted prospects are deduplicated by `customerRef`. Sample and trial row totals are separate from their unique `sampleContributors` and `trialCustomers` counts. A repeat requires the same independent customer to buy different input at least 24 hours later. Unknown eligibility or missing supporting evidence must not be promoted into a paid event merely to pass a target.

Public research uses organization names and anonymized demand-signal IDs with source links. Current intent and automated-contact permission remain unknown. Source summaries are attributable reports, not independent verification of companies' service claims. All sources were retrieved on October 20, 2026; revisit rules and pricing before execution.
