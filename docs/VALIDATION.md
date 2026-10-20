# Validation record

This document separates implementation, local testing, live integration, and business evidence. They are not interchangeable.

## GitHub publication and hosted CI — 2026-10-20

The source is public at [VictoR0213/ai-to-apify](https://github.com/VictoR0213/ai-to-apify). The repository name describes the AI-to-Apify workflow; QuotaForge remains the workbench's application and package name. GitHub reports both the author and committer of baseline [`af94513`](https://github.com/VictoR0213/ai-to-apify/commit/af9451325223befcd8b5f13002b2963163ee7340) as **VictoR0213**. The push-triggered workflow's actor and triggering actor are also VictoR0213.

All four jobs in the [first hosted CI run](https://github.com/VictoR0213/ai-to-apify/actions/runs/39421484339) completed successfully:

| Runner | Node | Tests | Clean demo and extracted source |
| :--- | :--- | :--- | :--- |
| Ubuntu | 22 | 57 passed, 0 failed | Passed |
| Ubuntu | 24 | 57 passed, 0 failed | Passed |
| Windows | 22 | 57 passed, 0 failed | Passed |
| Windows | 24 | 57 passed, 0 failed | Passed |

Each job also passed the 3 independent demo fixtures and generated Actor tests. The source archive SHA-256 was identical across the four environments:

```text
4ac0ca9b8480a90b7093c731518137c1b1ea12e2b1646f72722fd4470bd83fed
```

This hash identifies the initial baseline, before documentation was updated with hosted results. Later commits must be checked through their own workflow run and archive hash. Private vulnerability reporting is enabled. No GitHub tag or release was created during repository publication, and these local/cloud-free checks add no new provider, Apify or commercial evidence.

## Public-preview preparation — 2026-10-20

The reviewed local preview now passes **57 tests with 0 failures** on Windows with Node.js 24.19. Two regression cases cover ledger dates around midnight in Singapore and Los Angeles. Ledger validation now uses the computer's calendar date, matching the dashboard's date input.

| Local check | Recorded result |
| :--- | :--- |
| `node --run test` | 57 passed, 0 failed |
| `node --run demo:check` | 3 independent fixtures and 3 generated Actor tests passed; no deployment; empty ledger |
| `node --run preview:check` | Repeated ZIP builds were byte-identical; manifest and archive integrity checks passed; tests and the clean demo passed from extracted source |
| Browser walkthrough | Fresh isolated state; demo 3/3; generated specification inspected; empty receipt ledger; no observed browser warnings or errors |
| Public source assets | Reviewed screenshot and four-step [local walkthrough](../assets/local-demo.gif); actual dashboard captures with adjusted playback timing |
| GitHub Actions | Four Windows/Linux × Node 22/24 jobs configured; no hosted run observed |

The preparation did not call a model or perform an Apify operation. The latest live generation and cloud fixture evidence remains the October 15 record below; the earlier October 20 cloud inspection is a separate read-only checkpoint. This agent-operated local walkthrough does not establish unassisted onboarding by a new external operator. A full live generation-to-publication recording remains pending.

The first attempt in the restricted Windows execution sandbox failed on temporary-file replacement (`EPERM`) and loopback requests (`EACCES`). The same checks passed when those local operations were allowed. No application guard was disabled to obtain the pass. Hosted CI had not run at that preparation checkpoint; the later actual hosted result is recorded above.

See the [preview runbook](PUBLIC_PREVIEW.md) and [release-note draft](releases/v0.1.0.md). The final archive's adjacent `.zip.sha256` and embedded `PREVIEW-MANIFEST.json` identify its exact bytes; do not substitute an older archive hash after editing source.

## Operational checkpoint — 2026-10-20

All 55 local tests passed again. The public Actor remains on build `0.1.1`, and its remote source matches the tested local artifact. No new model generation, cloud acceptance run, or customer payment was established by this check. See the [dated update](updates/2026-10-20.md) for usage statistics, repository status and current limits.

## Recorded verification — 2026-10-15

The following results describe one tested checkout and environment. They are not a guarantee for every account, platform, or future provider version.

| Area | Recorded result | Scope |
| :--- | :--- | :--- |
| Automated suite | **55 tests passed; 0 failed** | Windows, Node.js 24.19; deterministic local and adapter tests |
| Live Codex generation | **Passed** | Official Codex CLI `0.162.0-alpha.17.2` returned a usable JSON specification with user configuration ignored; repeated successfully with explicit tool restrictions |
| Generated behavior | **3 independent fixtures passed** | All three live Codex checks produced specifications that agreed with the three expected outputs |
| Claude Code | **Live verification pending** | CLI not installed in the test environment; adapter behavior covered by automated tests |
| Apify private deployment | **Passed live** | Uploaded the Codex-generated artifact, compared remote source files, and built immutable version `0.1.1` successfully |
| Apify cloud acceptance | **Passed live** | One fixed nonempty fixture ran on build `0.1.1`; its 2 delivered records exactly matched the expected dataset |
| Apify public publication | **Passed live** | The account owner completed profile and Store agreement setup; the API confirmed public status and default build `0.1.1`, matching the checked build |
| Browser workflow | **Passed locally** | Demo creation, source viewer, invalid-JSON handling, and fixture verification exercised |
| Browser layout | **Passed locally** | Desktop and 390-pixel mobile viewport; no horizontal overflow or observed console errors |
| Customer revenue | **Not established** | No customer payment or profitable operator outcome verified |

The three live Codex requests completed in approximately 9.0, 8.3, and 8.5 seconds in this environment. The latter two used explicit tool restrictions and passed all three fixtures. The final package includes the required output schema and a typed dataset schema. These observations are not a latency benchmark or a subscription-capacity estimate.

The final cloud acceptance run was checked at `2026-10-15T07:12:28.884Z`. Its artifact SHA-256 was `ce866e03318cce114fe0b511df87daa30a1cf5129a03511f65e47103c5ef3fc2`. [The public example](https://apify.com/victor_zhu/public-catalog-normalizer) uses default build `0.1.1`, the same immutable build used for that check.

The two owner-run cloud checks reported combined runtime usage of `$0.0002869231756660674` at the last sync. Each run is recorded once; later syncs can refresh its reported amount as platform accounting settles. This excludes build costs and other operating costs. Recorded customer receipts and pending revenue remain zero. No creator fee was configured; Apify platform usage charges may apply.

## How to reproduce and extend the evidence

| Layer | How to check | What the result establishes |
| :--- | :--- | :--- |
| Local demo | `node --run demo` | The deterministic example can run locally without a provider or cloud account |
| Automated tests | `node --run test` | The behaviors covered by the current test suite agree with their fixtures |
| Environment | `node src/cli.mjs doctor` | Reports the local configuration and available integration prerequisites |
| Provider generation | Generate using an authenticated official CLI | A named CLI/account/environment can produce a usable specification |
| Apify deployment | Deploy privately, wait for build completion, and inspect a test run | A specific package works on the actual platform |
| Cloud smoke check | `node src/cli.mjs smoke <project-id> --confirm` | One independent fixture produces the expected dataset on the pinned private cloud build |
| Publication | Review the listing and explicitly publish | The checked build is publicly available; this is not a sale |
| Revenue | Reconcile operator records with external settlement evidence | A payment occurred on a stated basis; a ledger screenshot alone is insufficient |

**Live integrations must be recorded individually.** The Codex generation and Apify build, cloud acceptance and publication results above were verified live. Claude live verification remains pending. Adapter code, a mocked API response, or a successful local demo does not establish authenticated live success.

No real customer payment, profitable pilot, API cost advantage, or repeatable passive-income outcome is established by this repository.

## Repeatable local check

From the repository root:

~~~sh
node --version
node --run test
node --run demo
node src/cli.mjs doctor
node --run start
~~~

Open the dashboard at `http://127.0.0.1:4317`. Verify that the demo's fixture results are visible and that financial totals do not contain invented receipts.

For a clean, separate validation state, set `QF_DATA_DIR` to a dedicated temporary directory before running the demo. Do not delete a real project directory merely to reset a test.

## Provider acceptance

For each supported CLI, record:

- Operating system, Node version, and provider CLI version.
- Authentication method, without secrets.
- Project input and independently authored fixtures.
- Whether generation returned a valid specification.
- Test result and actionable error behavior.
- Provider-side consumption, when an authoritative value is available.

Authentication or quota failures must remain failures. Do not substitute deterministic demo output and label it as a successful model generation.

## Apify acceptance

Use an account authorized for the test. Start with a private Actor and a small input. Cloud usage may cost money.

1. Generate or select a known specification and pass the independent fixtures.
2. Review the generated package.
3. Deploy with explicit confirmation.
4. Wait for the actual build result.
5. Run `node src/cli.mjs smoke <project-id> --confirm`. This executes one nonempty independent fixture on the private Actor at the exact build number and compares its dataset output. Inspect the recorded result; a passing cloud check is required before publication.
6. Confirm that `record-normalized` is the intended event and review monetization settings in Console.
7. Sync run costs and verify that repeat syncs do not inflate totals.
8. Check the listing, pricing, permissions, and payout setup before explicitly publishing.

A build success does not verify that the Actor runs correctly. An event emitted by an Actor does not prove that the event has been configured for charging. A public listing does not prove a customer has paid.

Record build IDs, run IDs, timestamps, and sanitized results where appropriate. Never publish tokens, private billing details, or unredacted account records.

## Pilot decision criteria

The proposed first pilot is five external operators working on different, narrow needs. It is an experiment, not an earnings program.

Suggested criteria for further investment:

- At least four operators can set up and run the workflow from the documentation without remote takeover.
- At least three receive a genuine payment from an unrelated customer, without project-funded purchases.
- At least one genuine repeat purchase occurs.
- Include every operator, including zero-revenue and loss-making cases.
- The sample's median result is positive after incremental costs.
- Routine operation does not depend on the maintainers manually repairing each product.

Observe at least 30 days of operation and continue until actual settlement can be checked. Passing these criteria supports a larger experiment; it does not establish typical-user profitability.

## Financial comparison

Report two views when applicable:

1. **Incremental result:** for a user who already holds the subscription, subtract new costs caused by this activity.
2. **Fully loaded result:** also allocate subscription cost and record operator time.

Keep customer charges, pending platform revenue, net settlements, and costs on clearly stated bases. Avoid subtracting costs twice when a settlement is already net of those charges. Synced owner-visible run costs are an informational subset, not a complete platform reconciliation.

Compare subscription-assisted development and API-assisted development on the same accepted task quality. Include failed attempts and review time. Do not convert a model's estimated token count into a claimed cash saving without a supported price and workload comparison.

## Reporting failures

A useful report includes the exact command, sanitized input, expected behavior, actual behavior, environment, and the last relevant error. Review logs before posting them. Security-sensitive reports follow [SECURITY.md](../SECURITY.md).

## Before a public GitHub release

- Run the local suite and demo from a fresh checkout, and update the dated evidence above.
- Confirm that the README commands and screenshots match the shipped source.
- Inspect staged files for local state, `.env` files, credentials, and private evidence.
- Check relative documentation links, the license, and English-only public-facing material.
- Enable private vulnerability reporting on the public repository.
- Describe Claude and Apify live status accurately in the release notes; do not present the local demo as a deployment.
- Publish a tagged source release only after reviewing the final repository contents.
