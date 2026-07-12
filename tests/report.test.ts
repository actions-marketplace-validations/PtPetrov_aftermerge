import { describe, expect, it } from "vitest";
import { renderMarkdown } from "../src/report.js";
import type { DurabilityReport } from "../src/types.js";

describe("renderMarkdown", () => {
  it("shows per-file turnover and deduplicates repeated context signals", () => {
    const signal = {
      sha: "a".repeat(40),
      subject: "fix tracked behavior",
      committedAt: "2026-01-05T00:00:00Z",
    };
    const report: DurabilityReport = {
      schemaVersion: 2,
      generatedAt: "2026-02-10T00:00:00Z",
      pullRequest: {
        repository: "example/project",
        number: 7,
        title: "Agent change",
        url: "https://github.com/example/project/pull/7",
        author: "Copilot",
        mergedAt: "2026-01-01T00:00:00Z",
        mergeCommitSha: "b".repeat(40),
        baseRef: "main",
        baseSha: "c".repeat(40),
        headSha: "d".repeat(40),
        commitShas: ["d".repeat(40)],
        labels: [],
      },
      baselineCommit: "b".repeat(40),
      baselineParent: "c".repeat(40),
      trackedFiles: ["src/index.ts"],
      trackedLines: 4,
      horizons: [
        {
          days: 7,
          status: "ready",
          targetDate: "2026-01-08T00:00:00Z",
          trackedLines: 4,
          survivingLines: 2,
          survivalRate: 0.5,
          turnoverRate: 0.5,
          explicitReverts: [],
          likelyFixes: [signal],
        },
        {
          days: 30,
          status: "ready",
          targetDate: "2026-01-31T00:00:00Z",
          trackedLines: 4,
          survivingLines: 1,
          survivalRate: 0.25,
          turnoverRate: 0.75,
          explicitReverts: [],
          likelyFixes: [signal],
          files: [
            {
              path: "src/index.ts",
              category: "source",
              trackedLines: 4,
              survivingLines: 1,
              survivalRate: 0.25,
              turnoverRate: 0.75,
            },
          ],
          categories: [
            {
              category: "source",
              trackedLines: 4,
              survivingLines: 1,
              survivalRate: 0.25,
              turnoverRate: 0.75,
            },
          ],
        },
      ],
      limitations: ["Turnover is not a defect rate."],
    };

    const markdown = renderMarkdown(report);

    expect(markdown).toContain("Highest 30-day file turnover");
    expect(markdown).toContain("| source | 4 | 1 | 75.0% |");
    expect(markdown).toContain("| `src/index.ts` | source | 4 | 1 | 75.0% |");
    expect(markdown.match(/fix tracked behavior/g)).toHaveLength(1);
  });
});
