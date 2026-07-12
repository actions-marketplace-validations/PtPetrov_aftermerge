# AfterMerge

AfterMerge is an early proof for measuring what happens to a pull request after it merges. It tracks non-blank lines introduced by the PR and reports whether those exact Git line identities remain after 7 and 30 days. It also surfaces explicit reverts and likely follow-up fixes.

The tool deliberately calls the metric **turnover**, not defects. Deleted code can be a regression, a cleanup, or a successful temporary migration. The surrounding signals provide context; they do not replace engineering judgment.

> **Use coding agents regularly?** AfterMerge is selecting five teams for a
> [free read-only design-partner pilot](docs/DESIGN-PARTNER.md). No source upload,
> LLM runtime, or hosted account is required.

## Current proof

- Reads merged pull-request metadata from GitHub's REST API.
- Works with public repositories without a token, subject to GitHub's 60 requests/hour unauthenticated limit.
- Clones the repository with partial blob fetching.
- Uses zero-context Git diffs to identify added line ranges.
- Uses Git blame identities to measure same-file survival.
- Produces Markdown or versioned JSON.
- Breaks turnover down by file and inferred source, test, configuration,
  documentation, and generated categories.
- Does not use an LLM or upload prompts and local agent logs.

## Run locally

```bash
npm install
npm run dev -- analyze owner/repository --pr 123
```

For higher GitHub API limits:

```bash
GITHUB_TOKEN=... npm run dev -- analyze owner/repository --pr 123
```

To reuse an existing local clone:

```bash
npm run dev -- analyze owner/repository --pr 123 --local /path/to/repository
```

JSON output:

```bash
npm run dev -- analyze owner/repository --pr 123 --json
```

## Run as a GitHub Action

The proof ships as a composite action and writes its Markdown report to the
workflow summary. With no pull-request input it discovers recent merged PRs
from known coding-agent accounts. The checkout must include full history so the
7-day and 30-day snapshots are available.

```yaml
permissions:
  contents: read
  pull-requests: read

steps:
  - uses: actions/checkout@v4
    with:
      fetch-depth: 0
  - uses: PtPetrov/aftermerge@main
    with:
      github-token: ${{ github.token }}
```

Put that job on a weekly `schedule` and the report is autonomous. Use the
optional `pull-request` input for a one-off report. Agent author logins, lookback
days, and report limit are configurable inputs.

The action only asks for read access. It does not post comments or modify the
repository.

## What the result means

- **Survival**: tracked PR-added line identities still present at the horizon.
- **Turnover**: tracked lines deleted or rewritten by the horizon.
- **Explicit revert**: a later commit message identifies itself as reverting the merge or a PR commit.
- **Possible follow-up fix**: a later commit touching the PR's files has a fix/bug/hotfix/regression/revert term in its subject.

## Known limitations

- Cross-file moves may count as turnover.
- Blame-based results can change after history rewrites.
- Commit-subject classification is intentionally simple and can produce false positives.
- Discovery uses a configurable allowlist of agent GitHub logins; teams must add custom bot accounts.
- A durability score is not a code-quality score.

## Real-history validation

The first validation cohort analyzed 20 merged Copilot PRs across 14 public
repositories. It tracked 34,048 non-blank added lines, with 83.4% weighted
7-day survival and 82.9% weighted 30-day survival. The median PR retained 97.6%
of its tracked lines at 30 days. Read the
[full validation report](validation/2026-07-12-public-history.md), including the
measurement risks and the high-turnover cases that still need manual audit.
The subsequent
[high-turnover audit](validation/2026-07-12-high-turnover-audit.md) found that
the two 100% cases were documentation/process changes and that generated
pipeline outputs explained nearly all MDOcean turnover.

## Product gate

This repository stays a proof until analysis works on real public PRs. A hosted dashboard, database, Railway service, and paid plan are intentionally deferred until the metric is credible.
