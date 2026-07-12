import type {
  DurabilityReport,
  HorizonResult,
  LineIdentity,
  FileCategory,
  PullRequestMetadata,
} from "./types.js";
import { GitRepository } from "./git.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export function classifyPath(path: string): FileCategory {
  const lower = path.toLowerCase();
  const name = lower.split("/").at(-1) ?? lower;
  if (
    lower.startsWith(".calkit/notebooks/executed/") ||
    lower.startsWith(".calkit/runs/") ||
    lower.startsWith("results/") ||
    lower.includes("/generated/") ||
    lower.includes("/dist/") ||
    lower.includes("/coverage/") ||
    name === "dvc.lock"
  ) {
    return "generated";
  }
  if (
    lower.startsWith("docs/") ||
    lower.startsWith(".ai/") ||
    /\.(?:md|mdx|rst|adoc)$/.test(lower)
  ) {
    return "documentation";
  }
  if (
    /(^|\/)(?:test|tests|__tests__)(\/|$)/.test(lower) ||
    /(?:^|\.)test\.[^.]+$/.test(name) ||
    /(?:^|\.)spec\.[^.]+$/.test(name)
  ) {
    return "test";
  }
  if (
    lower.startsWith(".github/") ||
    /\.(?:ya?ml|toml|ini|properties)$/.test(lower) ||
    ["dockerfile", "makefile", "package-lock.json", "yarn.lock", "pnpm-lock.yaml"].includes(name)
  ) {
    return "configuration";
  }
  return "source";
}

export interface AnalyzeOptions {
  horizons?: number[];
  now?: Date;
  head?: string;
}

function identityKey(identity: LineIdentity): string {
  return `${identity.path}:${identity.commit}:${identity.originalLine}`;
}

export async function analyzePullRequest(
  repository: GitRepository,
  pullRequest: PullRequestMetadata,
  options: AnalyzeOptions = {},
): Promise<DurabilityReport> {
  const horizons = options.horizons ?? [7, 30];
  const now = options.now ?? new Date();
  const baseline = pullRequest.mergeCommitSha;

  await repository.ensureCommit(baseline);
  const baselineParent = await repository.firstParent(baseline);
  const resolvedHead = options.head
    ? await repository.resolve(options.head)
    : await repository.resolveFirst([
        `origin/${pullRequest.baseRef}`,
        "origin/HEAD",
        "HEAD",
      ]);
  const addedRanges = await repository.addedRanges(baselineParent, baseline);
  const trackedFiles = [...new Set(addedRanges.map((range) => range.path))].sort();

  const baselineBlames = new Map<string, LineIdentity[]>();
  for (const path of trackedFiles) {
    baselineBlames.set(path, await repository.blame(baseline, path));
  }

  const tracked = addedRanges.flatMap((range) => {
    const end = range.start + range.count;
    return (baselineBlames.get(range.path) ?? []).filter(
      (line) =>
        line.finalLine >= range.start &&
        line.finalLine < end &&
        line.content.trim().length > 0,
    );
  });

  const uniqueTracked = new Map(tracked.map((line) => [identityKey(line), line]));
  const trackedByPath = new Map<string, Map<string, LineIdentity>>();
  for (const [key, line] of uniqueTracked) {
    const lines = trackedByPath.get(line.path) ?? new Map<string, LineIdentity>();
    lines.set(key, line);
    trackedByPath.set(line.path, lines);
  }
  const mergedAt = new Date(pullRequest.mergedAt);
  const horizonResults: HorizonResult[] = [];

  for (const days of horizons) {
    const targetDate = new Date(mergedAt.getTime() + days * DAY_MS);
    if (targetDate > now) {
      horizonResults.push({
        days,
        status: "pending",
        targetDate: targetDate.toISOString(),
        trackedLines: uniqueTracked.size,
        explicitReverts: [],
        likelyFixes: [],
      });
      continue;
    }

    const targetCommit = await repository.commitAtOrBefore(
      resolvedHead,
      targetDate,
      baseline,
    );
    const targetIdentities = new Set<string>();
    const targetByPath = new Map<string, Set<string>>();
    for (const path of trackedFiles) {
      const identities = new Set<string>();
      for (const identity of await repository.blame(targetCommit, path)) {
        const key = identityKey(identity);
        targetIdentities.add(key);
        identities.add(key);
      }
      targetByPath.set(path, identities);
    }
    const survivingLines = [...uniqueTracked.keys()].filter((key) =>
      targetIdentities.has(key),
    ).length;
    const survivalRate =
      uniqueTracked.size === 0 ? 1 : survivingLines / uniqueTracked.size;
    const signals = await repository.signals(
      baseline,
      targetCommit,
      trackedFiles,
      [baseline, ...pullRequest.commitShas],
    );
    const files = [...trackedByPath.entries()]
      .map(([path, lines]) => {
        const survivingLines = [...lines.keys()].filter((key) =>
          targetByPath.get(path)?.has(key),
        ).length;
        const survivalRate = lines.size === 0 ? 1 : survivingLines / lines.size;
        return {
          path,
          category: classifyPath(path),
          trackedLines: lines.size,
          survivingLines,
          survivalRate,
          turnoverRate: 1 - survivalRate,
        };
      })
      .sort(
        (left, right) =>
          right.turnoverRate - left.turnoverRate ||
          right.trackedLines - left.trackedLines ||
          left.path.localeCompare(right.path),
      );
    const categoryTotals = new Map<
      FileCategory,
      { trackedLines: number; survivingLines: number }
    >();
    for (const file of files) {
      const total = categoryTotals.get(file.category) ?? {
        trackedLines: 0,
        survivingLines: 0,
      };
      total.trackedLines += file.trackedLines;
      total.survivingLines += file.survivingLines;
      categoryTotals.set(file.category, total);
    }
    const categories = [...categoryTotals.entries()]
      .map(([category, total]) => {
        const survivalRate =
          total.trackedLines === 0
            ? 1
            : total.survivingLines / total.trackedLines;
        return {
          category,
          ...total,
          survivalRate,
          turnoverRate: 1 - survivalRate,
        };
      })
      .sort(
        (left, right) =>
          right.trackedLines - left.trackedLines ||
          left.category.localeCompare(right.category),
      );

    horizonResults.push({
      days,
      status: "ready",
      targetDate: targetDate.toISOString(),
      targetCommit,
      trackedLines: uniqueTracked.size,
      survivingLines,
      survivalRate,
      turnoverRate: 1 - survivalRate,
      files,
      categories,
      ...signals,
    });
  }

  return {
    schemaVersion: 2,
    generatedAt: now.toISOString(),
    pullRequest,
    baselineCommit: baseline,
    baselineParent,
    trackedFiles,
    trackedLines: uniqueTracked.size,
    horizons: horizonResults,
    limitations: [
      "Turnover is not the same as a defect; intentional deletion and refactoring also count.",
      "The proof tracks non-blank added lines in their original files; cross-file moves may count as turnover.",
      "Likely follow-up fixes are inferred from commit subjects and require human interpretation.",
      "The analyzer measures committed Git history and does not attempt probabilistic AI-code detection.",
      "If the original base branch was deleted, the analyzer follows the current remote default branch or local HEAD.",
      "File categories are inferred from paths and extensions; they provide context but may be overridden by repository conventions.",
    ],
  };
}
