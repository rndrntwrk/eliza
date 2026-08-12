# Slop.cash Eliza Validation-First Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce the first receipt-backed Eliza validation outcome for `rndrntwrk` by proving issue `elizaOS/eliza#18512` resolved on the exact live `develop` head, publishing one bounded closure recommendation, and verifying the comment through GitHub readback.

**Architecture:** Keep the repository on trusted canonical `develop`, install the contribution skill only through Slop.cash's authenticated installer, and bind two focused test runs to one device-signed receipt. Recheck both issue state and remote head immediately before a single GitHub write; fail closed on any drift or contradictory evidence.

**Tech Stack:** Git/GitHub CLI, Slop.cash authenticated skill installer, Codex `gpt-5.6-sol`, Node `24.15.0`, Bun `1.3.14`, Vitest, Python 3 for bounded JSON and installer handling.

## Global Constraints

- Repository: `elizaOS/eliza`; integration branch: `develop`.
- Fork remote: `origin = git@github.com:rndrntwrk/eliza.git`.
- Canonical remote: `upstream = https://github.com/elizaOS/eliza.git`.
- Runtime versions: Node `24.15.0` and Bun `1.3.14` exactly.
- Approved contribution runtime: Codex `openai/gpt-5.6-sol`.
- Lane identifier: `rndrntwrk-codex-validate-18512`.
- Publish only if issue `#18512` remains open, unassigned, and without conflicting discussion.
- Publish only if the tested commit remains the exact live `upstream/develop` head.
- Do not change product source, open a pull request, close the issue, deploy, spend, create a wallet, access production/staging, or edit unrelated files.
- Do not include credentials, private prompts, raw usage logs, seed phrases, private keys, or unrelated workspace data in evidence.
- Preserve the generated receipt footer byte-for-byte with its v2 marker as the comment's final line.

---

## File and State Map

- Inspect: `AGENTS.md` — repository-wide toolchain, error, test, and GitHub rules.
- Inspect: `CONTRIBUTING.md` — contribution, evidence, and publication contract.
- Inspect: `packages/app-core/AGENTS.md` — app-core package-specific requirements.
- Inspect: `packages/app-core/README.md` — app-core ownership and commands.
- Inspect: `packages/app-core/scripts/run-node-supervisor.test.mjs` — two-test real-process supervisor path.
- Inspect: `packages/app-core/scripts/lib/run-node-supervisor-spawn-count.mjs` — resolved fail-fast counter reader.
- Inspect: `packages/app-core/scripts/lib/run-node-supervisor-spawn-count.test.mjs` — three-test failure-diagnostic contract.
- Create externally through authenticated installer: `${CODEX_HOME:-$HOME/.codex}/skills/contribute-to-eliza` — immutable installed skill symlink and verified version store.
- Create externally through receipt tooling: `${XDG_CONFIG_HOME:-$HOME/.config}/gitarmy` — bounded run state and local device key.
- Modify on GitHub: exactly one new comment on `elizaOS/eliza#18512`.
- Modify in repository during validation: none.

### Task 1: Establish the authenticated contribution workflow

**Files:**
- Inspect: `/tmp/eliza-codex.md`
- Create externally: `${CODEX_HOME:-$HOME/.codex}/skills/contribute-to-eliza`
- Inspect: `${CODEX_HOME:-$HOME/.codex}/skills/contribute-to-eliza/PROVENANCE.json`
- Inspect: `${CODEX_HOME:-$HOME/.codex}/skills/contribute-to-eliza/.gitarmy-authorization.json`
- Inspect: `${CODEX_HOME:-$HOME/.codex}/skills/contribute-to-eliza/SKILL.md`

**Interfaces:**
- Consumes: authenticated installer document at `https://slop.cash/projects/eliza/codex.md` and current Codex model configuration.
- Produces: verified `skill_dir` containing `scripts/run-receipt.mjs`, immutable provenance, and the contribution workflow instructions used by Tasks 2 and 3.

- [ ] **Step 1: Confirm the configured model and local toolchain prerequisites**

Run:

```bash
grep -n '^model = "gpt-5.6-sol"$' "$HOME/.codex/config.toml"
python3 --version
gh auth status
```

Expected: exactly one model line for `gpt-5.6-sol`, Python 3 succeeds, and `gh` reports `rndrntwrk` as the active authenticated account. Stop if any identity differs.

- [ ] **Step 2: Download and inspect the authenticated installer document**

Run:

```bash
curl -fsSLo /tmp/eliza-codex.md https://slop.cash/projects/eliza/codex.md
sed -n '1,$p' /tmp/eliza-codex.md
```

Expected: one fenced Bash block whose Python installer fixes `repository = "elizaOS/army"`, `skill_name = "contribute-to-eliza"`, validates archive SHA-256 plus GitHub blob identities, and atomically activates only an authorized `develop` or labeled candidate revision.

- [ ] **Step 3: Execute only the inspected fenced installer block**

Run:

```bash
python3 -c '
import pathlib, re, subprocess
text = pathlib.Path("/tmp/eliza-codex.md").read_text(encoding="utf-8")
blocks = re.findall(r"```bash\n(.*?)\n```", text, re.S)
if len(blocks) != 1:
    raise SystemExit(f"expected one Bash installer block, found {len(blocks)}")
block = blocks[0]
required = (
    "repository = \"elizaOS/army\"",
    "skill_name = \"contribute-to-eliza\"",
    "validate_provenance",
    "authorize_revision",
)
missing = [value for value in required if value not in block]
if missing:
    raise SystemExit(f"installer block missing required identities: {missing}")
subprocess.run(["/bin/bash", "-s"], input=block, text=True, check=True)
'
```

Expected: `Installed contribute-to-eliza at verified revision` followed by a
full 40-character lowercase hexadecimal commit ID. The authenticated installer
may instead report an already-verified no-op at that revision.

- [ ] **Step 4: Verify and read the installed skill completely**

Run:

```bash
skill_dir="${CODEX_HOME:-$HOME/.codex}/skills/contribute-to-eliza"
test -L "$skill_dir"
python3 -c '
import json, os, pathlib, re
root = pathlib.Path(os.path.expanduser(os.environ.get("CODEX_HOME", "~/.codex"))) / "skills" / "contribute-to-eliza"
provenance = json.loads((root / "PROVENANCE.json").read_text())
authorization = json.loads((root / ".gitarmy-authorization.json").read_text())
assert provenance["schemaVersion"] == "1"
assert provenance["name"] == "contribute-to-eliza"
assert provenance["repository"] == "elizaOS/army"
assert provenance["revisionStatus"] == "committed"
assert re.fullmatch(r"[0-9a-f]{40}", provenance["revision"])
assert authorization["schemaVersion"] == "1"
assert authorization["repository"] == "elizaOS/army"
assert authorization["revision"] == provenance["revision"]
print(provenance["revision"])
'
sed -n '1,$p' "$skill_dir/PROVENANCE.json"
sed -n '1,$p' "$skill_dir/.gitarmy-authorization.json"
sed -n '1,$p' "$skill_dir/SKILL.md"
```

Expected: every assertion passes, the revision is a full committed SHA, and the complete current skill instructions confirm Validate mode, repository `elizaOS/eliza`, target branch `develop`, and the receipt workflow.

### Task 2: Validate issue #18512 on the exact live develop head

**Files:**
- Inspect: `AGENTS.md`
- Inspect: `CONTRIBUTING.md`
- Inspect: `packages/app-core/AGENTS.md`
- Inspect: `packages/app-core/README.md`
- Test: `packages/app-core/scripts/lib/run-node-supervisor-spawn-count.test.mjs`
- Test: `packages/app-core/scripts/run-node-supervisor.test.mjs`
- Modify: none

**Interfaces:**
- Consumes: verified `skill_dir/scripts/run-receipt.mjs` from Task 1, clean canonical checkout, live issue state, Node `24.15.0`, and Bun `1.3.14`.
- Produces: one completed receipt for lane `rndrntwrk-codex-validate-18512` plus exact-SHA unit and real-process pass evidence.

- [ ] **Step 1: Return to a clean canonical validation branch**

Run:

```bash
git status --short --branch
git switch develop
git fetch --prune upstream develop
git merge --ff-only upstream/develop
git remote get-url origin
git remote get-url upstream
git status --short --branch
git rev-parse HEAD
git merge-base --is-ancestor 584fdf974d0c6912146415fb62be26e4f029cbb2 HEAD
```

Expected: the local-only docs branch is clean before switching; `develop`
fast-forwards exactly to `upstream/develop`; remotes equal the Global
Constraints; final status has no tracked or untracked changes; resolution
commit `584fdf974d0c6912146415fb62be26e4f029cbb2` is an ancestor of the tested
head.

- [ ] **Step 2: Materialize the trusted checkout and read all governing instructions**

Run:

```bash
git sparse-checkout disable
sed -n '1,$p' AGENTS.md
sed -n '1,$p' CONTRIBUTING.md
sed -n '1,$p' packages/app-core/AGENTS.md
sed -n '1,$p' packages/app-core/README.md
sed -n '1,$p' packages/app-core/scripts/lib/run-node-supervisor-spawn-count.mjs
sed -n '1,$p' packages/app-core/scripts/lib/run-node-supervisor-spawn-count.test.mjs
sed -n '1,$p' packages/app-core/scripts/run-node-supervisor.test.mjs
```

Expected: the checkout fully materializes; the helper rejects a missing counter with captured stderr; its focused suite contains three tests; the real-process suite contains two non-Windows tests.

- [ ] **Step 3: Recheck the stop gate against authoritative GitHub state**

Run:

```bash
issue_json="$(gh issue view 18512 --repo elizaOS/eliza --json state,assignees,comments,title,url)"
ISSUE_JSON="$issue_json" python3 -c '
import json, os
issue = json.loads(os.environ["ISSUE_JSON"])
assert issue["state"] == "OPEN", issue
assert issue["assignees"] == [], issue
assert issue["comments"] == [], issue
assert issue["title"] == "test(app-core): supervisor test hangs for 30s and hides the real failure when the child never spawns", issue
print(issue["url"])
'
```

Expected: every assertion passes. Any comment, assignment, closure, or title drift is a mandatory inspection-and-stop condition before measured work.

- [ ] **Step 4: Activate exact runtimes and install the frozen dependency graph**

Run:

```bash
export PATH="$HOME/.nvm/versions/node/v24.15.0/bin:$PATH"
test "$(node --version)" = "v24.15.0"
test "$(bun --version)" = "1.3.14"
bun install --frozen-lockfile
git status --short --branch
```

Expected: version assertions pass, Bun installs the committed lockfile without modifying it, and Git status remains clean.

- [ ] **Step 5: Start one measured validation run**

Run:

```bash
export PATH="$HOME/.nvm/versions/node/v24.15.0/bin:$PATH"
skill_dir="${CODEX_HOME:-$HOME/.codex}/skills/contribute-to-eliza"
python3 -c '
import glob, json, os
root = os.path.expanduser(os.environ.get("XDG_CONFIG_HOME", "~/.config"))
matches = []
for path in glob.glob(os.path.join(root, "gitarmy", "runs", "active", "run_*.json")):
    value = json.load(open(path, encoding="utf-8"))
    if value.get("lane") == "rndrntwrk-codex-validate-18512":
        matches.append(value["runId"])
assert matches == [], f"stale active validation runs require inspection: {matches}"
'
node "$skill_dir/scripts/run-receipt.mjs" start \
  --repo-root "$PWD" \
  --client codex \
  --model gpt-5.6-sol \
  --lane rndrntwrk-codex-validate-18512 \
  --json
```

Expected: JSON with a `runId` matching
`^run_[0-9A-HJKMNP-TV-Z]{26}$` and `usageStatus` of either `capturing` or
truthfully `unavailable`. The generated active run state is bound internally to
repository identity `elizaOS/eliza` and the hashed absolute repository root.

- [ ] **Step 6: Run the focused diagnostic helper contract**

Run:

```bash
export PATH="$HOME/.nvm/versions/node/v24.15.0/bin:$PATH"
bun run --cwd packages/app-core test scripts/lib/run-node-supervisor-spawn-count.test.mjs
```

Expected: one test file passes with exactly three passing tests, including immediate missing-counter failure with captured supervisor stderr.

- [ ] **Step 7: Run the focused real-process supervisor contract**

Run:

```bash
export PATH="$HOME/.nvm/versions/node/v24.15.0/bin:$PATH"
bun run --cwd packages/app-core test scripts/run-node-supervisor.test.mjs
```

Expected on macOS: one test file passes with exactly two passing tests; the real child relaunches twice before clean exit, and the restart-loop guard aborts after six spawns. Zero executed tests is failure.

- [ ] **Step 8: Finish the same measured run and audit local state**

Run:

```bash
export PATH="$HOME/.nvm/versions/node/v24.15.0/bin:$PATH"
skill_dir="${CODEX_HOME:-$HOME/.codex}/skills/contribute-to-eliza"
run_id="$(python3 -c '
import glob, json, os
root = os.path.expanduser(os.environ.get("XDG_CONFIG_HOME", "~/.config"))
matches = []
for path in glob.glob(os.path.join(root, "gitarmy", "runs", "active", "run_*.json")):
    value = json.load(open(path, encoding="utf-8"))
    if value.get("lane") == "rndrntwrk-codex-validate-18512":
        matches.append(value["runId"])
assert len(matches) == 1, matches
print(matches[0])
')"
node "$skill_dir/scripts/run-receipt.mjs" finish \
  --repo-root "$PWD" \
  --client codex \
  --model gpt-5.6-sol \
  --lane rndrntwrk-codex-validate-18512 \
  --run "$run_id" \
  --json
git status --short --branch
git rev-parse HEAD
```

Expected: JSON contains a signed receipt and footer; the footer ends in exactly one `elizaos-contribution-attribution:v2` marker; Git status remains clean; the final SHA is the tested SHA.

### Task 3: Publish once and verify authoritative GitHub readback

**Files:**
- Read externally: `${XDG_CONFIG_HOME:-$HOME/.config}/gitarmy/runs/completed/run_*.json`
- Modify externally: `https://github.com/elizaOS/eliza/issues/18512` with one comment
- Modify in repository: none

**Interfaces:**
- Consumes: clean tested `HEAD`, completed lane receipt from Task 2, current GitHub issue state, and current remote `develop` head.
- Produces: one public GitHub comment URL whose exact body is independently read back and compared with the locally constructed body.

- [ ] **Step 1: Recheck issue state and exact-head freshness immediately before writing**

Run:

```bash
issue_json="$(gh issue view 18512 --repo elizaOS/eliza --json state,assignees,comments,title,url)"
ISSUE_JSON="$issue_json" python3 -c '
import json, os
issue = json.loads(os.environ["ISSUE_JSON"])
assert issue["state"] == "OPEN", issue
assert issue["assignees"] == [], issue
assert issue["comments"] == [], issue
assert issue["title"] == "test(app-core): supervisor test hangs for 30s and hides the real failure when the child never spawns", issue
'
tested_sha="$(git rev-parse HEAD)"
remote_sha="$(git ls-remote https://github.com/elizaOS/eliza.git refs/heads/develop | awk '{print $1}')"
test "$tested_sha" = "$remote_sha"
git status --short --branch
```

Expected: all issue assertions pass, tested and remote SHAs are identical full commit IDs, and the worktree is clean. Any drift stops publication and requires a fresh Task 2 run.

- [ ] **Step 2: Publish one exact receipt-backed validation comment**

Run this as one shell block so the exact submitted body remains available for comparison:

```bash
set -eu
lane="rndrntwrk-codex-validate-18512"
tested_sha="$(git rev-parse HEAD)"
footer="$(LANE="$lane" python3 -c '
import glob, json, os
root = os.path.expanduser(os.environ.get("XDG_CONFIG_HOME", "~/.config"))
lane = os.environ["LANE"]
matches = []
for path in glob.glob(os.path.join(root, "gitarmy", "runs", "completed", "run_*.json")):
    value = json.load(open(path, encoding="utf-8"))
    if f"— [{lane}]" in value.get("footer", ""):
        matches.append((value["receipt"]["completedAt"], value["footer"]))
assert matches, "no completed receipt for lane"
matches.sort()
print(matches[-1][1])
')"
comment_body="$(TESTED_SHA="$tested_sha" FOOTER="$footer" python3 -c '
import os
sha = os.environ["TESTED_SHA"]
footer = os.environ["FOOTER"]
body = f"""## Independent validation — resolved on current `develop`

Validated #18512 independently against exact `elizaOS/eliza@{sha}` under Node `v24.15.0` and Bun `1.3.14`.

Resolution present on the tested head:
- fix commit `584fdf974d0c6912146415fb62be26e4f029cbb2` (`fix(app-core): fail fast when supervisor test child never spawns`, #18519)
- `readSpawnCountForSupervisorTest` rejects a missing `spawn-count.txt` immediately and preserves captured supervisor stderr

Focused proof:
- `bun run --cwd packages/app-core test scripts/lib/run-node-supervisor-spawn-count.test.mjs` — 1 file, 3/3 tests passed
- `bun run --cwd packages/app-core test scripts/run-node-supervisor.test.mjs` — 1 file, 2/2 real-process tests passed

Bounded conclusion: the reported hanging/diagnostic-loss defect is resolved on the exact current `develop` head. Recommend closing #18512 as completed. This validates the merged behavior; it does not claim authorship or maintainer closure authority.

{footer}"""
if not body.rstrip().splitlines()[-1].startswith("<!-- elizaos-contribution-attribution:v2 "):
    raise SystemExit("receipt marker is not the final line")
print(body)
')"
payload="$(COMMENT_BODY="$comment_body" python3 -c '
import json, os
print(json.dumps({"body": os.environ["COMMENT_BODY"]}))
')"
post_json="$(printf '%s' "$payload" | gh api --method POST repos/elizaOS/eliza/issues/18512/comments --input -)"
comment_id="$(POST_JSON="$post_json" python3 -c 'import json, os; print(json.loads(os.environ["POST_JSON"])["id"])')"
readback_json="$(gh api "repos/elizaOS/eliza/issues/comments/$comment_id")"
POST_JSON="$post_json" READBACK_JSON="$readback_json" EXPECTED_BODY="$comment_body" python3 -c '
import json, os
posted = json.loads(os.environ["POST_JSON"])
readback = json.loads(os.environ["READBACK_JSON"])
expected = os.environ["EXPECTED_BODY"]
assert posted["user"]["login"] == "rndrntwrk", posted["user"]
assert readback["user"]["login"] == "rndrntwrk", readback["user"]
assert posted["body"] == expected
assert readback["body"] == expected
assert posted["id"] == readback["id"]
assert readback["body"].rstrip().splitlines()[-1].startswith("<!-- elizaos-contribution-attribution:v2 ")
print(readback["html_url"])
'
```

Expected: one GitHub URL prints; posted and read-back identities are `rndrntwrk`; both bodies exactly match; the generated v2 marker is the final line. Do not retry blindly if the POST result is uncertain—read the issue first.

- [ ] **Step 3: Perform the completion audit**

Run:

```bash
gh issue view 18512 --repo elizaOS/eliza --json state,assignees,comments,url \
  --jq '{state,assignees:[.assignees[].login],url,comments:[.comments[]|{author:.author.login,url,body}]}'
git status --short --branch
git rev-parse HEAD
git ls-remote https://github.com/elizaOS/eliza.git refs/heads/develop
```

Expected: exactly one new `rndrntwrk` comment contains the tested SHA, both pass counts, bounded conclusion, and final signed marker; repository status is clean; local and remote SHAs still match; no branch, PR, deployment, wallet, or unrelated GitHub state was created.
