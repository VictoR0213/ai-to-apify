# GitHub public preview

**Repository:** [VictoR0213/ai-to-apify](https://github.com/VictoR0213/ai-to-apify) (public)<br>
**Workbench:** QuotaForge `v0.1.0` source preview<br>
**Updated:** October 20, 2026<br>
**Scope:** The public source repository has been created, the initial baseline pushed and its four hosted CI jobs verified as passing. Recheck subsequent revisions and onboarding, then prepare a reviewed tag and GitHub release; neither the tag nor release has been published.

AI to Apify describes the project goal: use an installed Codex or Claude Code CLI to generate a bounded data-tool specification, verify it against independent fixtures and package it as an Apify Actor. The local workbench, dashboard and CLI retain the QuotaForge name.

This preview asks a narrow question: can a new operator run the local workbench, inspect a bounded JSON normalizer and reproduce the independent fixture checks? It makes no earnings or fully autonomous business claim.

## Evidence and remaining work

| Item | Current evidence | Preview requirement |
| :--- | :--- | :--- |
| Local suite | [October 20 preview check](VALIDATION.md): 57 tests passed on Windows, Node.js 24.19 | Keep the actual result tied to the reviewed source; rerun after behavior changes |
| New-user local path | Clean demo and extracted-source checks passed locally; no npm dependencies, model account or Apify token needed | Still validate unassisted setup by a new external operator |
| Source bundle | `preview:check` passed: repeatable ZIP bytes, verified hashes and extracted-source checks; `preview:pack` creates the candidate | Inspect the final manifest and record the archive checksum before distribution |
| Codex | [October 15 live record](VALIDATION.md): real generation passed 3 independent fixtures | Preserve its date and scope; a local demo does not refresh this result |
| Claude Code | Adapter implemented and locally tested; live generation pending | Keep the limitation visible in the README and release notes |
| Apify | October 15 build, cloud fixture comparison and publication passed; October 20 read-only check confirmed build `0.1.1` and source integrity | Link the dated evidence; no new paid cloud operation is needed for local preview preparation |
| GitHub repository | Public source at [VictoR0213/ai-to-apify](https://github.com/VictoR0213/ai-to-apify); initial baseline `af9451325223befcd8b5f13002b2963163ee7340` | Review rendered documentation and reproduce setup from this remote |
| GitHub Actions | [Initial baseline run](https://github.com/VictoR0213/ai-to-apify/actions/runs/39421484339) passed all four Ubuntu/Windows × Node 22/24 jobs for `af9451325223befcd8b5f13002b2963163ee7340` | Inspect all jobs again for each subsequent published revision; the baseline result does not establish later commits pass |
| Security reporting | GitHub private vulnerability reporting enabled and confirmed for this repository | Use [the private advisory form](https://github.com/VictoR0213/ai-to-apify/security/advisories/new) for sensitive reports; keep the reporting path working |
| Demonstration | Reviewed screenshot and [four-step dashboard walkthrough](../assets/local-demo.gif) from a fresh local session | Full live generation-to-publication recording remains pending; keep local captures labeled accurately |
| Business | $0 recorded receipts at the October 20 checkpoint; customer payments and profitability unverified | Keep commercial hypotheses separate from observed results |

The full generation-to-publication recording in the [release plan](BUSINESS_AND_RELEASE_PLAN.md#github-public-preview-package) remains a follow-up. A newly recorded local walkthrough can accompany preparation, but it must be titled **Deterministic local demo** and must not be described as live AI generation or a cloud deployment. Report a preview without the full recording as having that remaining limitation.

## New-user check without personal credentials

Use a clean source copy and Node.js **22 or later**. No `npm install`, AI login or Apify account is required. Keep any personal `.env` file and project state outside this copy. The commands below only exercise local behavior.

Clone the public repository into a new directory:

~~~sh
git clone https://github.com/VictoR0213/ai-to-apify.git
cd ai-to-apify
git rev-parse HEAD
~~~

Record that revision with the results below. The repository directory is `ai-to-apify`; application commands and local state retain the QuotaForge name.

First run the repeatable checks:

~~~sh
node --run test
node --run demo:check
node --run preview:check
~~~

`demo:check` uses an empty temporary working directory and clears integration settings for the check. It checks the fixture results, empty ledger and absence of deployment, then independently tests the generated Actor. `preview:check` compares two in-memory ZIP builds byte for byte, verifies the SHA-256 manifest and runs the suite and demo from extracted source. It also checks rejection of corrupted packages, consistent CRLF normalization and exclusion of private files outside the allowlist. These checks do not establish model login or authenticated cloud success.

For the interactive dashboard walkthrough, use a separate local state:

From the repository root in PowerShell:

~~~powershell
node --version
$env:QF_DATA_DIR = Join-Path ([System.IO.Path]::GetTempPath()) ('quotaforge-preview-' + [guid]::NewGuid().ToString('N'))
node --run demo
node src/cli.mjs doctor
node --run start
~~~

On macOS or Linux:

~~~sh
node --version
export QF_DATA_DIR="$(mktemp -d -t quotaforge-preview.XXXXXX)"
node --run demo
node src/cli.mjs doctor
node --run start
~~~

Expected observations:

1. The suite exits successfully with no failing tests. Record the actual test count rather than assuming an older count.
2. The demo prints a project ID, passing results for all 3 independent fixtures, an artifact directory and an explicit deterministic-demo notice.
3. `doctor` reports the local environment. Missing provider CLIs and `apifyConfigured: false` are acceptable for this check. Detection is not an authentication test.
4. Open **http://127.0.0.1:4317**. Inspect the demo project, fixture results and generated files. The ledger should have no invented receipts, deployment or public-publication success.
5. Stop the server with **Ctrl+C**. Keep the temporary state if needed for a report. Restore `QF_DATA_DIR` in that shell before working on another project; do not delete an existing operator directory to reset this check.

If port 4317 is already in use, run `node src/cli.mjs serve --port 4318` and open `http://127.0.0.1:4318`. The server remains bound to loopback.

For a report, record the source commit or archive hash, operating system, Node version, exact commands, suite result, demo result, dashboard observations and any blocker. This is local onboarding evidence, not a live provider or cloud check.

## Source-only review

Review the actual staged files and the final archive; `.gitignore` alone does not protect a file that was already tracked or explicitly staged.

Include the application source and public assets, example fixtures, test suite, CI workflow, license, contribution and security guidance, `.env.example`, package metadata and English documentation. Generated Actors are outputs, not the QuotaForge source release.

Exclude:

- `.env` and other real environment files; API tokens, passwords, cookies, session files and provider authentication directories.
- `.quotaforge/`, custom `QF_DATA_DIR` contents, project databases, generated specifications and generated Actor packages from personal sessions.
- Private or customer input data, cloud logs, settlement evidence, receipts, payment references and account exports.
- Local export folders, release bundles, temporary recordings, diagnostic dumps, dependency folders and coverage reports.
- Personal screenshots, paths, account details, browser tabs, notifications or terminal scrollback that have not been reviewed for publication.

Before staging, inspect `git status --short --untracked-files=all`. Stage only reviewed source paths. Before committing, run:

~~~sh
git diff --cached --name-only
git diff --cached --stat
git diff --cached --check
git diff --cached
~~~

Inspect image and recording contents visually as well as their filenames. Check that example records are synthetic or authorized and that README/release links resolve. Review the final source manifest and archive entries again after packaging. Run a fresh-copy local check from that packaged source, so passing tests refer to the material a new user will receive.

The packager uses an explicit per-file allowlist and rejects symbolic links. Its fixed ZIP metadata and normalized UTF-8 text produce reproducible source bytes. Files outside that list are excluded even if they exist locally; review changes to the allowlist when adding public source files. This is an additional boundary, not a substitute for reviewing the included files.

No secret scan proves that all private material is absent. If a credential is found, exclude it before publishing and rotate it if it has already been disclosed.

## Short actual local recording

The included [local-demo.gif](../assets/local-demo.gif) shows four actual UI captures in order: an empty workbench, 3/3 passing fixtures, the generated specification and an empty ledger. It was captured from separate temporary state with Apify unconfigured. It loops for 14.5 seconds with adjusted reading time. It is a step walkthrough, not continuous real-time video; no terminal execution, live model call or cloud publication is shown. No browser warnings or errors were observed during this session.

Use a fresh local state and a clean terminal/browser view. Hide personal tabs and notifications. Do not display environment-variable values, `.env`, provider account screens or private project data.

Suggested 60–90 second sequence:

| Approximate time | Action | Visible statement |
| :--- | :--- | :--- |
| 0–10 seconds | Show the repository and `node --version` | “QuotaForge v0.1.0 — deterministic local demo” |
| 10–25 seconds | Run `node --run demo` | “No model calls, cloud deployment or simulated revenue” |
| 25–55 seconds | Start the server, open the demo, show the 3 fixture results and generated source | “Independent fixtures verify this example” |
| 55–75 seconds | Show the empty receipt ledger | “No customer payment has been established” |
| 75–90 seconds | Show the validation document and historical public example link | “Codex and Apify were checked live on October 15; Claude live verification remains pending” |

Capture the real command execution and dashboard. Keep the recording outside the source archive until it has been reviewed. Do not insert a successful result over a failed command or imply that opening a historical public listing performed a new deployment.

For a future live recording, use an operator-authorized account, sanitized fixtures and separate explicit confirmations for cloud operations. Record the provider version, generation result, fixture result, private build, exact-build cloud comparison and publication separately. New cloud work may incur charges; this preparation runbook does not authorize it.

## Verify a source revision for release

The initial public source baseline is [`af9451325223befcd8b5f13002b2963163ee7340`](https://github.com/VictoR0213/ai-to-apify/commit/af9451325223befcd8b5f13002b2963163ee7340). Its GitHub author and committer are `VictoR0213`. For each subsequent release candidate:

1. Finish the source-only review, record current local checks and review the release-note draft at [releases/v0.1.0.md](releases/v0.1.0.md).
2. Verify the intended maintainer identity with `git log -1 --format=fuller`. Use operator-supplied Git details for new commits; do not invent a maintainer identity.
3. Record the reviewed commit ID with `git rev-parse HEAD` and verify the working tree with `git status --short`.
4. Build and verify the source-only archive:

   ~~~sh
   node --run preview:check
   node --run preview:pack
   node scripts/preview.mjs verify release/quotaforge-v0.1.0-preview.zip
   ~~~

   `preview:pack` writes `release/quotaforge-v0.1.0-preview.zip` and `release/quotaforge-v0.1.0-preview.zip.sha256`. It builds and verifies the package; it does not run the suite or demo. Its JSON result reports the archive, checksum file, SHA-256 and source-file count. Verification checks the checksum sidecar and root `PREVIEW-MANIFEST.json`, whose entries record each source path, byte count and SHA-256. The manifest does not hash itself; the sidecar hashes the full archive. The `release/` output is excluded from public source. Inspect the manifest and confirm that the bundled source matches the reviewed revision; packaging reads local files, so a commit ID alone does not prove the archive matches it.

5. Record the archive SHA-256, source revision, exact verification commands and actual results. A preparation archive is not a published GitHub release.

## Hosted checks and tag/release follow-up

The public repository, first source push and passing baseline CI check are complete. Use [VictoR0213/ai-to-apify](https://github.com/VictoR0213/ai-to-apify) for subsequent reviewed changes. The remaining steps below do not imply that a tag, release or full workflow recording already exists.

1. Inspect `git remote -v` and verify that `origin` points to the intended repository:

   ~~~sh
   git remote get-url origin
   ~~~

   The HTTPS URL is `https://github.com/VictoR0213/ai-to-apify.git`. An SSH URL for the same owner and repository is also valid. Do not overwrite an unexpected remote automatically.

2. Review subsequent commits and source-only contents, then push the intended branch. For `main`:

   ~~~sh
   git push -u origin main
   ~~~

3. Inspect [Actions → Local preview checks](https://github.com/VictoR0213/ai-to-apify/actions/workflows/ci.yml) for this exact commit. Verify every configured Windows/Linux × Node 22/24 job and its logs, including `test`, `demo:check` and `preview:check`. A configured matrix, a local pass or a badge URL is not a GitHub CI result. Record the run URL and actual status; repair failures before calling the matrix passing.
4. Keep **Settings → Security → Private vulnerability reporting** enabled; it was enabled and confirmed on October 20, 2026. Verify that the reporting path in [SECURITY.md](../SECURITY.md) remains valid. Review the rendered README, relative links and assets on GitHub.
5. Update the release notes with the actual source revision, local/archive results, CI run URL and recording link. Describe any incomplete evidence plainly.
6. After final release review, create and push the `v0.1.0` tag on the reviewed commit, then create the GitHub release using [the prepared notes](releases/v0.1.0.md). Check first that the tag does not already exist. Attach only the reviewed source archive and checksum if supplying custom assets.
7. Verify the public repository and release from a signed-out view. Repeat the quickstart from the released source and record remaining onboarding issues.

The `v0.1.0` label is the QuotaForge source preview. The historical Apify example build `0.1.1` belongs to that separate deployed Actor and is not a QuotaForge release number.
