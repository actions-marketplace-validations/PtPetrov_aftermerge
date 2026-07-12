# AfterMerge agent guide

## Goal

Build a low-cost, privacy-conscious GitHub tool that measures what happens to agent-authored pull requests after merge. The product must distinguish neutral code turnover from evidence of failure.

## Commands

- Install: `npm install`
- Type-check: `npm run check`
- Test: `npm test`
- Build: `npm run build`
- Local CLI: `npm run dev -- analyze owner/repo --pr 123`

## Engineering rules

- Runtime code must not require an LLM.
- Never label deleted or rewritten code as defective without a separate failure signal.
- Do not upload prompts, source code, or local agent logs.
- Keep GitHub permissions read-only until a reporting action is explicitly implemented.
- Public-repository analysis must work without authentication within GitHub's rate limit.
- Add deterministic tests for every metric change.
- Prefer Git plumbing and the GitHub REST API over heuristics.
- Document known measurement limitations in user-facing reports.

## Verification

Before considering a change complete, run `npm run check`, `npm test`, and `npm run build`.
