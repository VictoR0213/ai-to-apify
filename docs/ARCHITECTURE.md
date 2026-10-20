# Architecture

QuotaForge is a local workbench with two interfaces: a browser dashboard and a Node.js CLI. Both operate on local project state. The application has no npm runtime dependencies; deployed Actors have their own packaging and cloud requirements.

## Product boundary

The initial tool family is JSON record normalization. A project contains an intended transformation, an independently specified fixture contract, a generated ToolSpec, verification results, and deployment/accounting metadata.

The model proposes a declarative specification. A maintained runtime performs a fixed set of allowed operations. The application does not execute arbitrary JavaScript returned by a model.

This boundary keeps generated behavior reviewable. It is not a general-purpose sandbox, and it does not prove that every possible input is handled correctly.

## Data flow

~~~mermaid
flowchart TD
    UI["Loopback dashboard"] --> CORE["Local application"]
    CLI["Node CLI"] --> CORE
    CORE --> STATE["Local project files"]
    CORE --> PROVIDER["Official provider CLI"]
    PROVIDER --> SPEC["Untrusted ToolSpec proposal"]
    SPEC --> CHECK["Schema + allowlist validation"]
    CHECK --> TEST["Trusted runtime + independent fixtures"]
    TEST --> PACKAGE["Actor package"]
    PACKAGE --> APIFY["Apify API"]
    APIFY --> COST["Run cost metadata"]
    COST --> LEDGER["Cost and receipt records"]
    RECEIPT["Operator-entered payment evidence"] --> LEDGER
~~~

## Trust boundaries

### Provider process

Provider authentication remains with the installed official CLI. QuotaForge supplies a generation request and consumes the proposed specification. Provider output is untrusted until it passes validation. The service uses a fresh empty system-temporary working directory for each generation and removes it after checking the expected parent path. Codex runs with user configuration ignored and its shell, app, plugin, delegation, browser, computer, hook, and web-search access disabled; Claude uses safe mode with tools disabled. These controls do not create an operating-system privacy boundary.

Executable paths are local trusted configuration. Do not accept them from a shared project or a remote user without inspection. CLI behavior, available authentication methods, and account limits can change independently of QuotaForge.

### Specification and fixtures

A ToolSpec describes allowed field mappings and transformations. The runtime validates the specification before use. Expected fixture results are a separate input; generation must not redefine them.

There are two distinct checks:

1. **Specification validity:** every requested operation is supported.
2. **Behavioral validity:** the tested outputs match the independent expected outputs.

Passing both establishes agreement on the tested cases. It does not establish market demand, universal data correctness, or the right to use a data source.

### Actor packaging

A verified specification is packaged with the trusted runtime. The deployed Actor uses ordinary code for customer runs; it does not route customers through the publisher's consumer AI subscription.

Deployment and public publication are separate actions. Cloud actions require an explicit confirmation. A separately confirmed cloud smoke check executes one nonempty acceptance fixture against the private Actor at an exact build number and compares the returned dataset. Publication requires that check to pass, verifies the build belongs to the intended Actor, and pins the checked immutable build number. Before each build or rebuild, version `0.1` must contain exactly the tested artifact's text source files, excluding folder entries. Remote source changes reject the build request. Sync refreshes remote build status; a failed build can be rebuilt after those checks. Failed builds must remain visible as failures, and an older passing local test is not evidence of a successful current cloud build.

### Credentials and local access

The dashboard binds to loopback. The Apify token stays on the backend side of the application. The CLI loads an ignored local `.env` file; shell environment values take precedence. The file is plaintext and should remain under the operator's control. Do not expose the application through a public tunnel or run it as a shared service.

Local state may include prompts, generated specifications, fixture data, deployment identifiers, costs, and accounting references. Keep it out of version control and backups intended for public distribution.

### Accounting

The source and meaning of each amount matter:

| Record | Meaning | Evidence limit |
| :--- | :--- | :--- |
| Apify run usage | Platform-reported cost of an owner-visible run | Not revenue; not complete marketplace usage or all operating costs |
| Pending amount | Expected revenue entered by an operator | Not settled cash |
| Payout | Net cash received, recorded by an operator | Self-reported until reconciled against independent payment records |
| Expense | Additional cash paid, recorded by an operator | Excludes deductions already reflected in net payouts |

All ledger amounts in this prototype are USD. There is no foreign-exchange conversion, automated bank reconciliation, or tax calculation.

Imported run usage is informational. It is not subtracted from net cash again: a settlement may already deduct platform costs. The operator must reconcile the actual basis and enter additional expenses consistently.

A payout can identify the pending entry it settles through its reference so the amount no longer remains outstanding. An evidence reference is a pointer to supporting material, not independent payment verification.

## Deployment model

- Run the workbench on the operator's own computer.
- Authenticate each provider using its supported local flow.
- Deploy Actors to the operator's own Apify account.
- Configure pricing, store details, and payout eligibility in Apify Console.
- Receive customer proceeds through the platform's own settlement process.

QuotaForge does not hold customer funds, split payouts, pool subscriptions, or create a central credential exchange.

## Deliberate limits

There is no automatic measurement of remaining provider quota. There is no claim that a fixed subscription yields a fixed number of sellable tools. There is no automated customer-acquisition system.

The MVP prioritizes a bounded, observable path from proposal to verification to deployment. Additional autonomy needs stronger integration evidence and operational controls before broader claims are appropriate.
