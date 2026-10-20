# QuotaForge: Business Model and Release Plan

> Build useful tools. Verify the result. Publish with evidence.

**Updated:** October 15, 2026<br>
**Status:** Working prototype; commercial validation pending<br>
**License:** MIT<br>
**Public example:** [Public Catalog Normalizer](https://apify.com/victor_zhu/public-catalog-normalizer)

**October 20 public preview:** The source is public at [VictoR0213/ai-to-apify](https://github.com/VictoR0213/ai-to-apify). Its [first hosted CI run](https://github.com/VictoR0213/ai-to-apify/actions/runs/39421484339) passed all four Windows/Linux × Node 22/24 jobs, each including 57 tests, a clean demo and extracted-source verification. English preview instructions, release notes, source-only packaging and a real dashboard walkthrough are included. Private vulnerability reporting is enabled; a tagged GitHub release and full live generation-to-publication recording remain pending. See the [preview runbook](PUBLIC_PREVIEW.md) and [dated evidence](VALIDATION.md). The earlier live results and commercial hypotheses below retain their original scope.

## 1. The business in one paragraph

QuotaForge is an open-source workbench that helps independent operators turn their own permitted AI development capacity into small, tested data tools. An operator uses Claude Code or Codex to generate a bounded specification, verifies it against independent fixtures, and deploys the resulting Actor to their own Apify account. Customers pay for useful results through that operator's Actor. The operator maintains the product and reconciles earnings and costs. QuotaForge's upstream project does not need a commission or a central billing service.

The commercial asset is a useful, maintained software product. Unused subscription allowance is an optional development input, not the item being sold.

## 2. Who participates and who gets paid

| Participant | Contribution | Economic role |
| :--- | :--- | :--- |
| QuotaForge maintainers | Open-source workbench, trusted templates, verification, documentation | No mandatory upstream fee or revenue share in the proposed model |
| Fork operators | Own AI setup, a specific product idea, fixtures, Apify account, maintenance and customer support | Receive the proceeds attributable to their own monetized Actors |
| Customers | A recurring data-processing need and authorized input data | Pay for delivered results under the Actor's published pricing |
| Apify | Runtime infrastructure, marketplace, billing and settlement | Applies its platform charges and revenue-sharing rules |
| AI providers | Official coding assistants and supported authentication | Apply their own product terms, subscription limits and billing |

Credentials stay with each operator's local setup. The model does not require shared subscriptions, transferred accounts, or a pool of subscription quotas. Provider permission for a particular use must be assessed separately; successful CLI execution does not establish that permission.

## 3. What exists today

The prototype has demonstrated a real technical workflow:

```text
Brief + independent fixtures
    -> Codex-generated ToolSpec
    -> validated, trusted runtime
    -> local acceptance tests
    -> private Apify build
    -> cloud dataset comparison
    -> public Actor with a pinned build
    -> run-usage records and a receipt ledger
```

| Area | Evidence recorded on October 15, 2026 |
| :--- | :--- |
| Local automated suite | 55 tests passed on Windows with Node.js 24.19 |
| Codex | Real generation succeeded; generated specifications passed 3 independent fixtures |
| Claude Code | Adapter implemented; live verification remains pending |
| Apify | Real build, cloud acceptance run and public publication succeeded |
| Published build | Default build is pinned to the checked immutable build, `0.1.1` |
| Output | Linked Actor output schema and typed dataset schema |
| Accounting | Owner-visible run usage sync; manual, evidence-referenced receipts and expenses |
| Customer income | No genuine customer payment or profitable operator outcome established |
| GitHub | Source and release materials prepared; repository publication remains pending |

The two owner-run cloud checks reported approximately **$0.000287 combined runtime usage** at the recorded sync. This excludes build costs, AI subscriptions and operator time. It is not a benchmark for large batches or evidence of profit.

The ledger distinguishes pending amounts, net cash received, additional expenses and informational platform usage. It does not independently verify payments or import all customer earnings.

## 4. The first commercial product hypothesis

The current public example normalizes a fixed set of catalog fields. It is a technical demonstration with limited differentiation.

The proposed first paid product is **Product Feed QA & Normalizer**, aimed at people who already collect product catalogs through Apify and need consistent data for downstream workflows.

| Proposed improvement | Customer outcome | Current status |
| :--- | :--- | :--- |
| Configurable field mapping | Reuse a workflow across different catalog sources | Proposed |
| CSV input alongside JSON | Process common supplier and catalog files | Proposed |
| Row-level validation diagnostics | Locate rejected rows and understand why they failed | Proposed |
| Explicit duplicate rules | Control which records are retained | Broader rules proposed; current example deduplicates by URL |
| Reusable export presets | Deliver a stable format to a downstream process | Proposed |
| Ready-to-import n8n or Make workflow | Reduce integration effort | Proposed |

Validate these requirements with real samples before implementing the entire list. Use public catalogs or authorized, sanitized samples.

Shopify-specific export is a possible later specialization. Do not advertise Shopify import compatibility until its field dependencies, variant behavior and representative imports have been tested.

## 5. Proposed pricing experiment

**These prices are hypotheses for an improved product, not prices already activated on the public example.**

| Charge | Proposed amount |
| :--- | ---: |
| Actor start | $0.01 per run |
| Successfully delivered normalized record | $0.002 per record |
| Main event | `record-normalized` |
| Underlying platform usage | Include in the proposed event price; measure the operator's actual cost |

| Delivered records in one run | Proposed customer charge |
| ---: | ---: |
| 100 | $0.21 |
| 1,000 | $2.01 |
| 10,000 | $20.01 |

A nearby catalog normalizer lists a starting price of $2 per 1,000 records. That is an asking-price reference, not evidence of sales or willingness to pay. [Comparable listing](https://apify.com/zentrafoundry/csv-json-schema-normalizer)

Under Apify's documented PPE model, eligible event revenue is shared 80% to the creator before underlying platform usage costs are deducted. Usage by customers on free plans does not contribute creator revenue under that calculation. [Apify pricing and costs](https://docs.apify.com/actors/publishing/monetize/pricing-and-costs)

For example, a $2.01 charge to an eligible paying customer yields $1.608 before the applicable runtime cost and other business expenses. This is arithmetic, not a profit forecast.

Complete billing and payout details, then configure monetization in **Publishing > Monetization > Set up monetization**. Use the custom delivery event as primary and avoid also charging the default dataset event for the same record. Verify the effective pricing and charge limits before a paid pilot. Significant changes generally have notice requirements, with an exception when there are no paying users. [Apify monetization setup](https://docs.apify.com/actors/monetize/set-up-monetization)

The current public example has no creator fee configured. Apify platform usage charges may still apply.

## 6. Unit economics and the quota hypothesis

Track both incremental and fully loaded results.

```text
Platform contribution
    = eligible event revenue after reversals
      - platform revenue share
      - applicable platform usage costs

Fully loaded operating result
    = platform contribution
      - build and maintenance costs
      - external services
      - allocated AI subscription or API cost
      - customer acquisition and support
      - other applicable operating costs
```

When reconciling cash, start from actual net settlements and subtract only additional cash expenses. Do not subtract deductions already included in those settlements a second time.

Spare allowance may lower incremental development spending for an existing subscriber. That advantage remains unproven. Compare subscription-assisted and API-assisted development on the same task quality, including failed attempts and operator time. Do not extrapolate the two small cloud checks into large-scale margins.

Token consumption, stars, forks, generated tools and free runs are not revenue metrics.

## 7. Where the first paying customers should come from

Start with people who already have the problem and already use the surrounding tools.

| Priority | Audience and location | Acquisition experiment |
| :--- | :--- | :--- |
| 1 | Existing paid Apify users in relevant community discussions | Find repeated catalog-cleanup questions; demonstrate results on an authorized sample |
| 2 | E-commerce automation providers using n8n or Make | Offer a reproducible integration template and a comparison with their current workflow |
| 3 | Users searching Apify Store for a specific cleanup task | Publish a focused listing with input/output examples, explicit limitations and clear pricing |

Initial discovery and support require human work. Community participation should follow local rules and address an existing need. Broad launches are more useful after independent users can complete the workflow.

Use GitHub to distribute the workbench and reusable examples. Use the Actor listing and integrations to explain the customer outcome. Track developer adoption and customer purchases separately.

### First 14-day demand experiment

These are experiment targets, not predicted conversion rates:

1. Identify 20-30 relevant candidates and complete 10 substantive problem conversations.
2. Obtain at least 3 real, authorized samples and identify the repeated requirement.
3. Implement only the smallest improvement needed to solve that requirement.
4. Have users run the tool themselves with published pricing.
5. Seek 3 unrelated paying customers and at least 1 repeat use.
6. Record refusals, failures, support time, costs and zero-income outcomes.

If users try the tool but do not pay, reassess the problem, audience or product. Generating more nearly identical Actors is not a substitute for this evidence.

## 8. Future release plan

Milestones are gated by evidence rather than fixed launch dates. Version labels below are proposed.

| Stage | Deliverable | Exit condition |
| :--- | :--- | :--- |
| Current prototype | Codex-to-Apify workflow and live public example | Technical path demonstrated; no commercial claim |
| Public preview: v0.1.0 | English GitHub repository, tagged source release, onboarding and actual demo | Release review complete; documented demo reproducible; CI status reported accurately; provider limitations visible |
| Paid pilot: v0.2.0 | One focused commercial tool, workflow template, pricing and cost measurements | Real users complete paid runs; billing matches delivered results; failures and support are recorded |
| Operator pilot: v0.3.0 | Five external operators publish distinct useful tools | At least four set up independently; at least three receive an unrelated customer payment; at least one repeat purchase occurs |
| Expansion | Additional tool families and maintenance automation | A positive median incremental result and manageable support burden are observed across the operator sample |

Observe the operator pilot for at least 30 days and continue until settlement evidence can be checked. Include unsuccessful operators in the results. A small successful pilot justifies further experiments, not a typical-income claim.

### GitHub public-preview package

The release should include:

- An English README with the existing banner, real dashboard screenshot and concise quickstart.
- A short actual recording of generation, verification and publication, with all credentials hidden.
- A link to the public example and a dated evidence table.
- MIT license, contribution guide, security reporting guidance and example fixtures.
- Clear labels for implemented adapters versus live-tested integrations.
- Fresh-checkout checks and visible results from the configured Windows/Linux, Node 22/24 CI matrix.
- A release description that states what works, known limits and the next validation milestone.
- A source-only release that excludes local credentials, project state and private payment evidence.

Publishing the repository does not require an earnings claim. Commercial results can be added later with appropriate evidence.

Suggested public positioning:

> Build and verify small Apify tools with your own AI coding assistant.

## 9. Metrics and decision rules

| Question | Measure |
| :--- | :--- |
| Can a new operator start? | Unassisted setup completion, time and documented blockers |
| Does the generated tool work? | Independent fixture results, cloud checks and real-input failures |
| Do customers value it? | Eligible paid usage, unrelated paying customers and repeat purchases |
| Is it economically useful? | Reconciled settlements, complete costs and operator time |
| Can the project scale? | Maintenance and support effort per active tool |

Expand when independent operators can repeat the workflow and customers pay again. Revise the product when adoption is limited by unclear value, configuration burden or weak retention.

The long-term goal is a useful open-source system for creating and maintaining small software businesses. Fully unattended onboarding, customer acquisition and profitable operation remain future hypotheses.
