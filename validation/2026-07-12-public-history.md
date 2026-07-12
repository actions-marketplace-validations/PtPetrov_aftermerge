# Public-history validation — 2026-07-12

## Result

AfterMerge completed 20 analyses across 14 public repositories on GitHub-hosted
runners. The set covers merged pull requests authored by GitHub Copilot's coding
agent and includes documentation, application code, build tooling, lockfiles,
MATLAB, Kotlin, Java, TypeScript, and Python changes.

| Measure | Result |
| --- | ---: |
| Pull requests | 20 |
| Repositories | 14 |
| Non-blank added lines tracked | 34,048 |
| Weighted 7-day survival | 83.4% |
| Weighted 30-day survival | 82.9% |
| Median 30-day PR survival | 97.6% |
| PRs with any 30-day turnover | 11 |
| Explicit reverts detected | 0 |

The successful matrix run is
[`29183163218`](https://github.com/PtPetrov/aftermerge-/actions/runs/29183163218).

## Largest 30-day turnover results

| Pull request | Tracked lines | 7-day turnover | 30-day turnover |
| --- | ---: | ---: | ---: |
| `JGtm/LevelUp#3` | 1,910 | 100.0% | 100.0% |
| `sydlexius/stillwater#809` | 11 | 100.0% | 100.0% |
| `JGtm/LevelUp#19` | 423 | 66.9% | 94.6% |
| `cbkii/hotspotadb#5` | 36 | 0.0% | 58.3% |
| `symbiotic-engineering/MDOcean#227` | 7,321 | 36.0% | 36.1% |
| `symbiotic-engineering/MDOcean#203` | 4,259 | 18.4% | 18.4% |

These numbers are neutral code-turnover measurements. They are not defect
rates. Each high-turnover case still needs a history audit to distinguish
rework, intentional replacement, branch integration, generated files, and
actual regression repair.

## Product findings

1. The Git/blame metric scales across varied public repositories on GitHub
   Actions without a hosted service.
2. Deleted intermediate base branches are common enough to require a fallback
   to the current default branch. The first run found this edge case; the
   regression fix produced a 20/20 successful rerun.
3. The commit-subject `likelyFixes` heuristic is too noisy for large PRs. Ten
   PRs produced at least one match, and one broad change produced 101 matches.
   It must remain context—not a failure label—and should be replaced with a
   higher-precision signal before a paid beta.
4. Weighted averages are dominated by very large PRs. Per-PR distributions and
   size bands are more interpretable than a single portfolio score.
5. No explicit revert was found in this sample, so revert detection remains
   tested synthetically but not validated by this public cohort.

## Next gate

- Audit the six highest-turnover histories manually.
- Replace or narrow the noisy likely-fix heuristic.
- Add size-band portfolio summaries.
- Put the Action in front of five teams that regularly merge coding-agent PRs.
- Do not deploy Railway until at least one team asks for persistent cross-repo
  reporting.
