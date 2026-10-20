# Contributing to QuotaForge

Thank you for helping make small tools easier to ship and easier to evaluate honestly.

The most useful early contributions are reproducible bug fixes, stronger independent fixtures, clearer onboarding, and documented integration results.

## Get started

Use Node.js 22 or later.

~~~sh
node --run test
node --run demo
node --run start
~~~

The local application uses Node built-ins. Do not add a dependency unless it materially improves the product and its maintenance cost is justified.

Read [the architecture](docs/ARCHITECTURE.md) before changing provider execution, specification validation, deployment, or accounting.

## Keep changes focused

1. Explain the concrete problem and the expected behavior.
2. Make the smallest coherent change.
3. Add or update meaningful tests for changed behavior.
4. Run the relevant tests and update affected documentation.
5. Describe what you verified and any remaining limitations in the pull request.

Use English for code comments, UI copy, documentation, issue templates, and public release material.

Do not include API keys, authentication tokens, provider session data, private customer inputs, or personal payment records. Local state and generated output should remain outside tracked source files.

## Product principles

- **Fixtures define the contract.** Do not let generated output redefine the expected answer.
- **Generated input stays untrusted.** Preserve specification validation and the allowlisted runtime boundary.
- **Cloud actions stay explicit.** Do not turn local tests into paid calls or public publication.
- **Money keeps its meaning.** Usage costs are not income, pending amounts are not cash, and manual ledger entries are not audited receipts.
- **Failures remain visible.** Do not silently replace failed integrations with demo responses.
- **Claims need evidence.** Avoid fabricated usage numbers, earnings, testimonials, badges, or benchmark comparisons.

## Tests and integration reports

Prefer deterministic local tests. Live provider and Apify tests should be separately identified, require the operator's own authentication, and state their cost implications.

Never require secrets merely to run the normal local test suite. If you report a live integration result, follow [VALIDATION.md](docs/VALIDATION.md) and sanitize the evidence.

For a public-preview candidate, run `node --run demo:check` and `node --run preview:check`. These checks isolate demo state and verify the extracted source package. Run `node --run preview:pack` to create the reviewed ZIP and checksum. See the [preview runbook](docs/PUBLIC_PREVIEW.md) for the release process. When adding or removing public source files, review and update the explicit `SOURCE_FILES` allowlist in `scripts/source-archive.mjs`; private data and generated outputs must stay outside it.

## Pull request checklist

- The change has a clear user-facing purpose.
- Tests cover meaningful new or corrected behavior.
- Documentation matches the actual CLI and UI.
- No credentials, local project data, or generated state are committed.
- Any claim of live verification includes its scope and limitations.

## License

By submitting a contribution, you agree that your contribution may be distributed under the repository's [MIT License](LICENSE). Do not contribute material you do not have the right to license.
