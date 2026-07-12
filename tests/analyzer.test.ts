import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import { analyzePullRequest } from "../src/analyzer.js";
import { GitRepository, parseAddedRanges } from "../src/git.js";
import type { PullRequestMetadata } from "../src/types.js";

const execFileAsync = promisify(execFile);
const directories: string[] = [];

async function git(directory: string, args: string[], date?: string): Promise<string> {
  const environment = date
    ? { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date }
    : process.env;
  const { stdout } = await execFileAsync("git", args, {
    cwd: directory,
    env: environment,
  });
  return stdout.trim();
}

async function createRepository(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "aftermerge-test-"));
  directories.push(directory);
  await git(directory, ["init", "--quiet", "-b", "main"]);
  await git(directory, ["config", "user.name", "AfterMerge Test"]);
  await git(directory, ["config", "user.email", "test@aftermerge.local"]);
  return directory;
}

async function commitFile(
  directory: string,
  content: string,
  message: string,
  date: string,
): Promise<string> {
  await writeFile(join(directory, "index.ts"), content, "utf8");
  await git(directory, ["add", "index.ts"]);
  await git(directory, ["commit", "--quiet", "-m", message], date);
  return git(directory, ["rev-parse", "HEAD"]);
}

function metadata(mergeCommitSha: string, mergedAt: string): PullRequestMetadata {
  return {
    repository: "example/project",
    number: 42,
    title: "Agent-authored change",
    url: "https://github.com/example/project/pull/42",
    author: "agent[bot]",
    mergedAt,
    mergeCommitSha,
    baseRef: "main",
    baseSha: "unused-in-proof",
    headSha: mergeCommitSha,
    commitShas: [mergeCommitSha],
    labels: ["agent-generated"],
  };
}

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("parseAddedRanges", () => {
  it("extracts added and replacement ranges while ignoring deleted files", () => {
    const diff = [
      "diff --git a/index.ts b/index.ts",
      "--- a/index.ts",
      "+++ b/index.ts",
      "@@ -1,0 +2,3 @@",
      "+one",
      "+two",
      "+three",
      "@@ -8 +11 @@",
      "-old",
      "+new",
      "diff --git a/old.ts b/old.ts",
      "--- a/old.ts",
      "+++ /dev/null",
      "@@ -1 +0,0 @@",
      "-gone",
    ].join("\n");

    expect(parseAddedRanges(diff)).toEqual([
      { path: "index.ts", start: 2, count: 3 },
      { path: "index.ts", start: 11, count: 1 },
    ]);
  });
});

describe("analyzePullRequest", () => {
  it("measures rewritten and deleted lines as turnover and finds follow-up fixes", async () => {
    const directory = await createRepository();
    await commitFile(
      directory,
      "export const existing = true;\n",
      "initial",
      "2026-01-01T12:00:00Z",
    );
    const baseline = await commitFile(
      directory,
      [
        "export const existing = true;",
        "export const durable = 'keep';",
        "export const rewritten = 'first';",
        "export const temporary = 'remove';",
        "",
      ].join("\n"),
      "agent feature",
      "2026-01-02T12:00:00Z",
    );
    await commitFile(
      directory,
      [
        "export const existing = true;",
        "export const durable = 'keep';",
        "export const rewritten = 'second';",
        "",
      ].join("\n"),
      "fix regression in agent feature",
      "2026-01-05T12:00:00Z",
    );
    await commitFile(
      directory,
      [
        "export const existing = true;",
        "export const durable = 'keep';",
        "export const rewritten = 'second';",
        "export const later = true;",
        "",
      ].join("\n"),
      "later unrelated work",
      "2026-02-05T12:00:00Z",
    );

    const report = await analyzePullRequest(
      GitRepository.open(directory),
      metadata(baseline, "2026-01-02T12:00:00Z"),
      { now: new Date("2026-02-10T12:00:00Z"), head: "HEAD" },
    );

    expect(report.trackedLines).toBe(3);
    expect(report.horizons).toHaveLength(2);
    for (const horizon of report.horizons) {
      expect(horizon.status).toBe("ready");
      expect(horizon.survivingLines).toBe(1);
      expect(horizon.survivalRate).toBeCloseTo(1 / 3);
      expect(horizon.turnoverRate).toBeCloseTo(2 / 3);
      expect(horizon.likelyFixes.map((signal) => signal.subject)).toContain(
        "fix regression in agent feature",
      );
    }
  });

  it("detects an explicit git revert", async () => {
    const directory = await createRepository();
    await commitFile(
      directory,
      "export const existing = true;\n",
      "initial",
      "2026-01-01T12:00:00Z",
    );
    const baseline = await commitFile(
      directory,
      "export const existing = true;\nexport const agentLine = true;\n",
      "agent feature",
      "2026-01-02T12:00:00Z",
    );
    await git(
      directory,
      ["revert", "--no-edit", baseline],
      "2026-01-03T12:00:00Z",
    );
    await commitFile(
      directory,
      "export const existing = true;\nexport const later = true;\n",
      "later work",
      "2026-02-05T12:00:00Z",
    );

    const report = await analyzePullRequest(
      GitRepository.open(directory),
      metadata(baseline, "2026-01-02T12:00:00Z"),
      { now: new Date("2026-02-10T12:00:00Z"), head: "HEAD" },
    );

    const sevenDay = report.horizons[0];
    expect(sevenDay?.survivingLines).toBe(0);
    expect(sevenDay?.explicitReverts).toHaveLength(1);
    expect(sevenDay?.explicitReverts[0]?.subject).toContain("Revert");
  });
});
