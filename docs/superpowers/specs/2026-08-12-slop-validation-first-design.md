# Slop.cash Eliza Validation-First Design

## Objective

Earn the first credible Eliza contributor outcome for GitHub account
`rndrntwrk` by independently validating open issue `elizaOS/eliza#18512`
against the exact current `develop` head, publishing one receipt-backed
evidence comment, and verifying that comment through GitHub readback.

Completion requires all of the following:

- the authenticated `contribute-to-eliza` skill is installed from verified
  Slop.cash bytes;
- the checkout has `origin` set to `rndrntwrk/eliza` and `upstream` set to
  `elizaOS/eliza`;
- the validation runs under repository-pinned Bun `1.3.14` and Node `24.15.0`;
- the focused real-process supervisor test for issue `#18512` passes on the
  exact current `upstream/develop` commit;
- the measured run finishes and supplies an unchanged signed receipt footer;
- exactly one evidence comment is published to issue `#18512` and read back
  from GitHub with the expected commit, command, result, and receipt.

The displayed Slop.cash reward is a projection, not a payment guarantee.
Maintainer acceptance remains outside this workflow's control.

## Scope

In scope:

- authenticated local contribution-skill installation;
- trusted `upstream/develop` source inspection and focused test execution;
- validation evidence for the already-implemented supervisor-test repair;
- one GitHub issue comment recommending closure;
- authoritative GitHub readback of the published artifact.

Out of scope:

- source-code changes, pull requests, merges, or issue closure;
- deployment, staging, production, cloud credentials, or infrastructure;
- spending, wallet creation, seed phrases, or private-key handling;
- publishing a payout marker before the user selects a public Solana address;
- unrelated issue triage or repository cleanup.

## Approaches Considered

### 1. Validation first — selected

Reproduce the focused test on current trusted `develop`, confirm the fix that
is already present, and publish closure evidence. This has the smallest blast
radius and shortest path to a score-bearing artifact because it requires no
production change, contributor branch execution, or code authorship.

Trade-off: validation may receive less score than an implementation, and the
project owner decides whether it is accepted.

### 2. Review first

Independently review a small test-only pull request such as `#18539` or
`#18540`. This can be valuable, but contributor-controlled code must be treated
as hostile input and executed only in a disposable OS sandbox. The local Docker
daemon is currently unavailable, so execution proof would be blocked or the
review would have to remain static.

### 3. Implementation first

Claim and repair an unowned issue. This can produce more outcome score, but the
current small candidates either depend on open work (`#18543` depends on
`#18522`) or may expand when adjacent security changes land (`#18423`). This is
the second contribution lane, not the first.

## Workflow and Components

1. **Identity and checkout**
   - Use authenticated GitHub account `rndrntwrk`.
   - Keep `origin` on the user's fork and `upstream` on the canonical repository.
   - Fetch and resolve the exact live `upstream/develop` SHA before evidence.

2. **Authenticated contribution tooling**
   - Inspect the Slop.cash installer instructions before execution.
   - Install or update the verified `contribute-to-eliza` skill atomically.
   - Start a measured run from the repository root with a stable validation
     lane and preserve the returned run identifier.

3. **Trusted validation**
   - Confirm issue `#18512` is still open, unclaimed, and not contradicted by
     newer discussion immediately before work.
   - Inspect the root and package instructions plus the exact helper and test.
   - Put Node `24.15.0` first on `PATH` without changing the user's global
     shell configuration.
   - Run the focused real-process test that exercises the supervisor exit path.
   - Record the exact SHA, command, runtime versions, and pass counts.

4. **Receipt and publication**
   - Finish the same measured run and preserve the emitted footer byte-for-byte.
   - Build one concise comment that distinguishes independent validation from
     authorship and recommends closure without claiming maintainer authority.
   - Publish once, then use GitHub readback to verify the comment URL and body.

## Data Flow

Slop.cash provides authenticated skill bytes and contribution rules. The local
checkout provides trusted source and tests at an immutable `develop` SHA. The
focused test produces local execution evidence. The run-receipt tool binds the
measured session to the repository and model metadata. The final GitHub comment
contains only public validation facts and the generated receipt; GitHub
readback becomes the publication proof.

No credentials, private prompts, raw usage logs, private keys, or unrelated
workspace data enter the comment or receipt.

## Failure and Stop Conditions

Stop before publication and report the blocker if any of these occurs:

- issue `#18512` is closed, claimed, or gains conflicting current evidence;
- the exact runtime model cannot satisfy the contribution skill's approved
  model contract;
- authenticated skill provenance fails or the installer bytes cannot be
  inspected and verified;
- the repository origin, branch, or live SHA differs from the intended target;
- the focused test fails, runs zero tests, or does not exercise the real path;
- the receipt cannot be finished or its footer is malformed;
- GitHub publication would require credentials or permissions not already
  authorized.

Do not weaken a failed check, substitute a different issue silently, fabricate
evidence, or post a partial success claim.

## Verification

Before publication:

- `git status --short --branch` shows the validation checkout is clean;
- GitHub read-only inspection confirms live issue state;
- `node --version` is exactly `v24.15.0` and `bun --version` is `1.3.14`;
- the focused supervisor test exits zero with a nonzero passing test count;
- the exact `upstream/develop` SHA is captured after the final fetch;
- the measured run finishes successfully and emits its signed footer.

After publication:

- GitHub readback returns exactly one new comment from `rndrntwrk`;
- the comment names the validated SHA, command, observed pass result, and
  bounded conclusion;
- the receipt footer is the final line and matches the local generated value;
- no branch, PR, deployment, wallet, or unrelated repository state changed.

## Next Lane

After this outcome is published and acknowledged, select either a small
independent PR review with disposable execution isolation or a bounded unowned
implementation issue. Payout-marker setup is a separate gate requiring the
user's chosen public Solana address.
