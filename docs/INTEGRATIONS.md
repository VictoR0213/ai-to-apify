# Provider and Apify integrations

These adapters require Node.js 22 or newer. They use native CLI processes and the public Apify HTTP API, with no production mock mode. Tests inject a fetch function and exercise the native process transport using Node itself. They do not call a model or spend money.

## Model providers

`detectProviders()` runs `--version` only. It does not inspect credentials or verify login, remaining subscription allowance, or model access. A successful detection is not an authentication check.

`generateSpec({ provider, prompt, schema, cwd, timeoutMs, maxBudgetUsd, signal })` returns `{ spec, metadata }`. The caller must apply its domain validation to `spec`; this module rejects malformed JSON and unsuccessful CLI responses but is not a general JSON Schema validator.

Install and sign into the official CLI yourself. Override its executable location with `QF_CLAUDE_BIN` or `QF_CODEX_BIN` in the local environment. Values are executable paths, not command strings. Windows requires a native `.exe`; `.cmd`, `.bat`, and PowerShell wrappers are deliberately unsupported to avoid shell interpolation. No credentials belong in a prompt.

- Codex uses `exec --ignore-user-config --json --ephemeral --output-schema ... --output-last-message ... --skip-git-repo-check -s read-only -` and receives the prompt through stdin. It also passes `--disable` for `shell_tool`, `unified_exec`, `view_image`, `apps`, `plugins`, `multi_agent`, `browser_use`, `computer_use`, `hooks`, `code_mode_host`, and `workspace_dependencies`, plus `-c web_search="disabled"`. A recent official Codex CLI supporting these flags is required. User configuration is ignored while official authentication in `CODEX_HOME` and the CLI default model are retained. The adapter does not bypass sandboxing or alter global configuration. `maxBudgetUsd` is rejected because this integration cannot enforce a dollar cap.
- Claude uses `-p --safe-mode --output-format json --json-schema ... --tools "" --disallowedTools "mcp__*" --no-session-persistence`. Safe mode prevents user or project hooks and MCP customizations from loading while retaining the official login. Built-in and MCP tools are disabled. `--max-budget-usd` is supplied only when requested. A recent official Claude Code release supporting these flags is required.
- Both integrations have a wall-clock timeout, bounded output, cancellation, and process-tree termination. Raw CLI stderr is withheld from errors because it could contain credentials or prompt data. Only OS configuration and authentication environment variables for the selected official provider are inherited. Publishing tokens, web-session tokens, and unrelated cloud/service credentials are not inherited. Authentication and actual billing remain the CLI provider's responsibility.
- The service creates a fresh empty working directory under the system temporary directory for each live generation. It removes that directory after the attempt, first checking that its resolved parent is the expected temporary directory. Provider response/schema files are separate temporary files cleaned by the adapter. If calling the adapter directly with a custom `cwd`, use a clean directory without secrets.
- Tool restrictions, configuration isolation, and an empty working directory reduce access paths; they are not an operating-system privacy boundary. The CLI process still runs under the local user account. Prompts and example records are sent to the selected provider. The application validates the returned declarative specification and uses its own allowlisted runtime for deployable behavior.

Official references, checked 2026-10-15:

- [Claude Code CLI flags](https://code.claude.com/docs/en/cli-reference)
- [Programmatic CLI usage](https://code.claude.com/docs/en/headless)
- [Authentication and subscription tokens](https://code.claude.com/docs/en/authentication)
- [Embedding and credential conditions](https://code.claude.com/docs/en/legal-and-compliance)
- Codex flags were verified against the installed official `codex exec --help`. CLI support does not grant a right to pool, transfer, or resell subscription usage.

## Apify

Generated packages include linked Actor output and typed dataset schemas, including a table view of the delivered fields. These describe the delivered records and satisfy the Console output-metadata prerequisite for publication. Newly created Actors use the Developer Tools category and limited permissions.

Set `APIFY_TOKEN` locally. The adapter uses only `https://api.apify.com/v2/`, a Bearer header, and redirect rejection. It never puts tokens in URLs. All mutations are attempted once: a timeout or network failure can leave an unknown remote outcome, so inspect Apify Console before retrying. Cancellation stops the HTTP request; it does not abort a cloud build or run already accepted by Apify.

`createActor` accepts text source files as an object map or an array of `{ name, content }`, creates version `0.1` with `SOURCE_FILES`, and keeps the Actor private. `buildActor` requests version `0.1` with the `latest` build tag. Default runs are bounded to 120 seconds and 256 MiB. `publishActor` sets `isPublic: true` and optionally pins the default build; this does not configure monetization, verify identity, certify quality, or demonstrate revenue.

`listRuns` and `getDatasetItems` paginate with at most 100 items per page and use a default `maxItems` of 1,000; the constructor accepts limits up to 10,000. `listRuns` remains a bounded view, not a complete financial export. When `getDatasetItems` reaches the limit, it requests one additional item to check completeness. If another item exists, it throws `DATASET_LIMIT` instead of returning a silently truncated dataset. Pagination is not an atomic snapshot of a collection changing during the requests. Responses are limited to 10 MiB, sources to 100 files / 5 MiB, and run input to 1 MiB. HTTP timeout defaults to 30 seconds. All methods accept an optional final `{ signal }` argument.

Before every build or rebuild, the service calls `getActorVersion(actorId, "0.1")`. The remote version must use `SOURCE_FILES`. After excluding folder entries, the service compares each text file's name and contents with the tested local artifact. Changed, missing, extra, or unsupported remote files reject the build request. This check does not lock the remote account against concurrent changes by its owner.

The API response is the source of truth. An Actor being public, a run succeeding, or estimated usage cost is never treated as settled customer revenue.

If publication returns `username-required`, open **Settings > Account > Profile** in Apify Console. Set a public username, enable **Make profile publicly visible**, and save the profile, completing any confirmation dialog. Saving a username alone does not publish the profile. Contact email visibility is a separate choice. First publication can also return `store-terms-not-accepted`: the account owner must review and accept the Store publishing agreement in the Actor's Publishing tab before retrying. QuotaForge maps this known API reason to fixed guidance without exposing server error text.

Official API references:

- [Create Actor and SOURCE_FILES schema](https://docs.apify.com/api/v2/actors-post)
- [Build Actor](https://docs.apify.com/api/v2/actors-builds-post)
- [Update Actor](https://docs.apify.com/api/v2/actor-put)
- [List Actor runs](https://docs.apify.com/api/v2/actors-runs-get)
- [Run Actor](https://docs.apify.com/api/v2/actors-runs-post)
- [Dataset items](https://docs.apify.com/api/v2/dataset-items-get)
- [Publishing and payout obligations](https://docs.apify.com/legal/store-publishing-terms-and-conditions)


### Pin the verified cloud build when publishing

Call `getActor(actorId)` to retrieve canonical `id` and the `username` / `name` alias when checking ownership. The official Get Build response uses `actId` (not `actorId`) and includes `buildNumber`. Pass the verified three-part number to `publishActor(actorId, { buildNumber })`. This updates `isPublic` and the default run settings in one PUT request, pinning `defaultRunOptions.build` to the tested build rather than the mutable `latest` tag. It retains a 120-second timeout, 256 MiB memory, and disables restart-on-error. The service layer is responsible for requiring the build number and verifying ownership, success, and artifact identity before calling this method.

- [Get Actor](https://docs.apify.com/api/v2/actor-get)
- [Get Build: actId and buildNumber fields](https://docs.apify.com/api/v2/actor-build-get)

A customer can explicitly request another build, and the owner can later change settings in Apify Console. Pinning protects the default build chosen at publication; it does not revoke those external permissions.

### Pin the cloud acceptance run

Call `runActor(actorId, input, { buildNumber })` with the same verified immutable three-part build number used for publication. This sends the exact version in the `build` query parameter and retains the 120-second / 256 MiB limits. Invalid build numbers are rejected before any HTTP request. Omitting the option keeps the general adapter default of `latest`; the publishing service must always provide the verified number for its acceptance run and compare the resulting dataset with its fixed fixture.