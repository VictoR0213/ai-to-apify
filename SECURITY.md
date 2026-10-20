# Security

QuotaForge is a personal local prototype. It invokes installed provider tools and can deploy to an external cloud account. Keep the workbench on your own machine and inspect what you authorize.

## Report a vulnerability privately

Do not post credentials, exploit payloads containing private data, or sensitive account information in a public issue.

If the repository has GitHub private vulnerability reporting enabled, use **Security → Report a vulnerability**. If that option is unavailable, open a minimal issue asking the maintainers for a private contact method, without publishing exploit details.

Fork maintainers should enable private vulnerability reporting before a public release. No response-time guarantee is currently offered.

## Scope

Potentially relevant issues include:

- Remote access to a service intended for loopback use.
- Credential exposure in browser responses, logs, generated packages, or repository files.
- Command injection or unintended provider executable execution.
- Bypasses of ToolSpec validation or arbitrary code execution.
- Unintended deployment, publication, or paid platform actions.
- Corruption, duplication, or misleading classification of financial records.

## Operating guidance

- Use official provider authentication flows.
- Treat `QF_CODEX_BIN` and `QF_CLAUDE_BIN` as trusted executable configuration.
- Supply `APIFY_TOKEN` only to the local backend process, using a local shell environment or the ignored `.env` file. The CLI loads `.env` from its working directory; existing shell values take precedence.
- A local `.env` file stores credentials in plaintext. Keep it on your own machine, restrict access appropriately, and never force-add it to Git or attach it to an issue.
- Keep local state and payment evidence out of public repositories.
- Review source rights and data sensitivity before supplying fixtures.
- Do not expose the server through port forwarding, a public tunnel, or a shared host.
- Review Actor contents and platform pricing before publication.
- Rotate a credential promptly if it is accidentally disclosed.

Generation runs in a fresh empty system-temporary directory. The service checks its expected parent before cleanup. Provider tools are restricted as described in [the integration documentation](docs/INTEGRATIONS.md). These measures do not isolate the process from the operating system: the official CLI still runs under the local user account, and submitted prompts and examples reach the selected provider.

The trusted runtime narrows what generated specifications can do. It is not an operating-system sandbox, and the local application is not designed for hostile multi-user access.

## Supported versions

This project is an early prototype with no long-term support branch. Security fixes target the current source revision. Downstream forks are responsible for adopting fixes and reviewing any changes they make to the trust boundaries.
