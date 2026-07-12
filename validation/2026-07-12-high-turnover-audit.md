# High-turnover audit — 2026-07-12

This audit reviews the six highest 30-day turnover results from the first
20-pull-request cohort. Turnover means an introduced Git line identity was later
rewritten or removed. It does not establish why that happened.

| Pull request | 30-day turnover | Dominant explanation | Interpretation |
| --- | ---: | --- | --- |
| `JGtm/LevelUp#3` | 100.0% | 1,910/1,910 tracked lines were versioned plans and documentation | Plan replacement, not a code-defect signal |
| `sydlexius/stillwater#809` | 100.0% | 11/11 lines were agent instructions and repository documentation | Process-document evolution |
| `JGtm/LevelUp#19` | 94.6% | 275/400 changed lines were an implementation plan; CI, scripts, tests, and services were also rapidly replaced | Broad architectural rework; attribution requires issue/CI linkage |
| `cbkii/hotspotadb#5` | 58.3% | README was fully replaced; 9/23 introduced Kotlin lines changed later | Strongest candidate for genuine follow-up rework, but not proven failure |
| `symbiotic-engineering/MDOcean#227` | 36.1% | 2,640/2,640 changed lines were executed notebooks or pipeline results | Generated-output churn |
| `symbiotic-engineering/MDOcean#203` | 18.4% | 775/783 changed lines were pipeline state or generated results | Core implementation largely survived |

## Conclusions

1. A repository-level percentage is insufficient. File and category context
   must be visible before a maintainer can interpret turnover.
2. Documentation and generated artifacts must not be silently discarded; they
   can matter, but they should not be mixed with source code in one opaque score.
3. A commit whose subject contains `fix` and touches any tracked file is weak
   evidence. Shared logs and broad generated-output sets create many unrelated
   matches. The report now deduplicates and caps these signals, but the JSON
   keeps them for auditability.
4. `hotspotadb#5` is the best candidate in this cohort for testing stronger
   causal signals because a later SettingsHook fix overlaps the changed Kotlin
   file.
5. The paid-product wedge should be explainable post-merge history, not a
   universal AI-code quality score.

## Product changes resulting from the audit

- Added per-file survival and turnover.
- Added path-based source, test, configuration, documentation, and generated
  categories without excluding any data.
- Added category composition to Markdown reports.
- Deduplicated and capped fix-labeled context in Markdown.
- Preserved full context in versioned JSON.
