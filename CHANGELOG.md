# Changelog

## v0.1 — public design-partner build

- Analyze merged pull requests at 7-day and 30-day horizons.
- Discover recent PRs from configured coding-agent accounts.
- Track non-blank added-line survival without an LLM runtime.
- Report neutral turnover rather than labeling rewritten code defective.
- Break results down by file and inferred source, test, configuration,
  documentation, and generated categories.
- Surface explicit reverts and capped, deduplicated fix-labeled context.
- Handle deleted original base branches by following the current default branch.
- Produce Markdown workflow summaries and versioned JSON.
- Validate the analyzer across 20 agent-authored PRs in 14 public repositories.
