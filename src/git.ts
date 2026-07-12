import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { AddedRange, CommitSignal, LineIdentity } from "./types.js";

const execFileAsync = promisify(execFile);

interface RunOptions {
  allowFailure?: boolean;
}

const GIT_TIMEOUT_MS = 90_000;

export class GitRepository {
  private constructor(
    public readonly directory: string,
    private readonly temporary: boolean,
  ) {}

  public static async clonePublic(
    repository: string,
    branch: string,
  ): Promise<GitRepository> {
    const directory = await mkdtemp(join(tmpdir(), "aftermerge-"));
    try {
      await execFileAsync(
        "git",
        [
          "clone",
          "--quiet",
          "--no-checkout",
          "--no-tags",
          "--single-branch",
          "--branch",
          branch,
          "--filter=blob:none",
          `https://github.com/${repository}.git`,
          directory,
        ],
        { maxBuffer: 20 * 1024 * 1024, timeout: GIT_TIMEOUT_MS },
      );
      return new GitRepository(directory, true);
    } catch (error) {
      await rm(directory, { recursive: true, force: true });
      throw new Error(
        `Could not clone ${repository} within ${GIT_TIMEOUT_MS / 1000} seconds. ` +
          "Use --local with an existing full-history checkout.",
        { cause: error },
      );
    }
  }

  public static open(directory: string): GitRepository {
    return new GitRepository(directory, false);
  }

  public async dispose(): Promise<void> {
    if (this.temporary) await rm(this.directory, { recursive: true, force: true });
  }

  public async ensureCommit(sha: string): Promise<void> {
    if (await this.hasObject(`${sha}^{commit}`)) return;
    await this.run(["fetch", "--quiet", "origin", sha]);
  }

  public async resolve(revision: string): Promise<string> {
    return (await this.run(["rev-parse", revision])).trim();
  }

  public async firstParent(commit: string): Promise<string> {
    return this.resolve(`${commit}^1`);
  }

  public async addedRanges(parent: string, commit: string): Promise<AddedRange[]> {
    const diff = await this.run([
      "diff",
      "--no-color",
      "--no-ext-diff",
      "--no-renames",
      "--unified=0",
      parent,
      commit,
      "--",
    ]);
    return parseAddedRanges(diff);
  }

  public async blame(commit: string, path: string): Promise<LineIdentity[]> {
    if (!(await this.hasObject(`${commit}:${path}`))) return [];
    const output = await this.run([
      "blame",
      "--line-porcelain",
      "-M",
      "-C",
      commit,
      "--",
      path,
    ]);
    return parseBlame(output, path);
  }

  public async commitAtOrBefore(
    head: string,
    date: Date,
    floor: string,
  ): Promise<string> {
    const candidate = (
      await this.run(["rev-list", "-1", `--before=${date.toISOString()}`, head])
    ).trim();
    if (!candidate) return floor;
    const isAfterFloor = await this.isAncestor(floor, candidate);
    return isAfterFloor ? candidate : floor;
  }

  public async commitDate(commit: string): Promise<string> {
    return (await this.run(["show", "-s", "--format=%cI", commit])).trim();
  }

  public async signals(
    baseline: string,
    target: string,
    paths: string[],
    knownShas: string[],
  ): Promise<{ explicitReverts: CommitSignal[]; likelyFixes: CommitSignal[] }> {
    if (baseline === target) return { explicitReverts: [], likelyFixes: [] };
    const output = await this.run([
      "log",
      "--format=%H%x1f%cI%x1f%s%x1f%B%x1e",
      `${baseline}..${target}`,
      "--",
      ...paths,
    ]);
    const commits = output
      .split("\x1e")
      .map((record) => record.trim())
      .filter(Boolean)
      .flatMap((record): Array<CommitSignal & { body: string }> => {
        const [sha, committedAt, subject, body] = record.split("\x1f");
        if (!sha || !committedAt || subject === undefined) return [];
        return [{ sha, committedAt, subject, body: body ?? "" }];
      });

    const needles = new Set(
      knownShas.flatMap((sha) => [sha.toLowerCase(), sha.slice(0, 12).toLowerCase()]),
    );
    const explicitReverts = commits
      .filter((commit) => {
        const message = `${commit.subject}\n${commit.body}`.toLowerCase();
        return (
          message.includes("revert") &&
          [...needles].some((needle) => message.includes(needle))
        );
      })
      .map(({ sha, subject, committedAt }) => ({ sha, subject, committedAt }));

    const fixPattern = /\b(fix(?:e[sd])?|bug(?:fix)?|hotfix|regression|revert(?:ed|s)?)\b/i;
    const likelyFixes = commits
      .filter((commit) => fixPattern.test(commit.subject))
      .map(({ sha, subject, committedAt }) => ({ sha, subject, committedAt }));

    return { explicitReverts, likelyFixes };
  }

  private async isAncestor(ancestor: string, descendant: string): Promise<boolean> {
    const result = await this.run(
      ["merge-base", "--is-ancestor", ancestor, descendant],
      { allowFailure: true },
    );
    return result.exitCode === 0;
  }

  private async hasObject(object: string): Promise<boolean> {
    const result = await this.run(["cat-file", "-e", object], {
      allowFailure: true,
    });
    return result.exitCode === 0;
  }

  private async run(
    args: string[],
    options?: RunOptions & { allowFailure?: false },
  ): Promise<string>;
  private async run(
    args: string[],
    options: RunOptions & { allowFailure: true },
  ): Promise<{ stdout: string; exitCode: number }>;
  private async run(
    args: string[],
    options: RunOptions = {},
  ): Promise<string | { stdout: string; exitCode: number }> {
    try {
      const { stdout } = await execFileAsync("git", args, {
        cwd: this.directory,
        maxBuffer: 100 * 1024 * 1024,
        timeout: GIT_TIMEOUT_MS,
      });
      return options.allowFailure ? { stdout, exitCode: 0 } : stdout;
    } catch (error) {
      if (options.allowFailure) {
        const exitCode =
          typeof error === "object" && error !== null && "code" in error
            ? Number(error.code)
            : 1;
        return { stdout: "", exitCode };
      }
      throw error;
    }
  }
}

export function parseAddedRanges(diff: string): AddedRange[] {
  const ranges: AddedRange[] = [];
  let path: string | undefined;

  for (const line of diff.split("\n")) {
    if (line.startsWith("+++ ")) {
      const value = line.slice(4);
      path = value === "/dev/null" ? undefined : value.replace(/^b\//, "");
      continue;
    }
    if (!path || !line.startsWith("@@")) continue;
    const match = /\+(\d+)(?:,(\d+))?/.exec(line);
    if (!match?.[1]) continue;
    const count = match[2] === undefined ? 1 : Number(match[2]);
    if (count > 0) ranges.push({ path, start: Number(match[1]), count });
  }
  return ranges;
}

export function parseBlame(output: string, path: string): LineIdentity[] {
  const identities: LineIdentity[] = [];
  let current:
    | { commit: string; originalLine: number; finalLine: number }
    | undefined;

  for (const line of output.split("\n")) {
    const header = /^(\^?[0-9a-f]{40}) (\d+) (\d+)(?: \d+)?$/.exec(line);
    if (header?.[1] && header[2] && header[3]) {
      current = {
        commit: header[1].replace(/^\^/, ""),
        originalLine: Number(header[2]),
        finalLine: Number(header[3]),
      };
      continue;
    }
    if (line.startsWith("\t") && current) {
      identities.push({ path, ...current, content: line.slice(1) });
      current = undefined;
    }
  }
  return identities;
}
