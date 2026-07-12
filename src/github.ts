import type { PullRequestMetadata } from "./types.js";

const API_VERSION = "2022-11-28";

interface GitHubPullResponse {
  number: number;
  title: string;
  html_url: string;
  merged_at: string | null;
  merge_commit_sha: string | null;
  base: { ref: string; sha: string };
  head: { sha: string };
  user: { login: string } | null;
  labels: Array<{ name?: string }>;
}

interface GitHubCommitResponse {
  sha: string;
}

interface GitHubPullListResponse {
  number: number;
  merged_at: string | null;
  user: { login: string } | null;
}

export interface DiscoverOptions {
  since: Date;
  authors: string[];
  limit?: number;
}

export class GitHubClient {
  public constructor(private readonly token?: string) {}

  public async getPullRequest(
    repository: string,
    number: number,
  ): Promise<PullRequestMetadata> {
    const pull = await this.request<GitHubPullResponse>(
      `/repos/${repository}/pulls/${number}`,
    );

    if (!pull.merged_at || !pull.merge_commit_sha) {
      throw new Error(`Pull request ${repository}#${number} is not merged.`);
    }

    const commits = await this.paginate<GitHubCommitResponse>(
      `/repos/${repository}/pulls/${number}/commits`,
    );

    return {
      repository,
      number: pull.number,
      title: pull.title,
      url: pull.html_url,
      author: pull.user?.login ?? "unknown",
      mergedAt: pull.merged_at,
      mergeCommitSha: pull.merge_commit_sha,
      baseRef: pull.base.ref,
      baseSha: pull.base.sha,
      headSha: pull.head.sha,
      commitShas: commits.map((commit) => commit.sha),
      labels: pull.labels.flatMap((label) =>
        label.name === undefined ? [] : [label.name],
      ),
    };
  }

  public async discoverMergedPullRequests(
    repository: string,
    options: DiscoverOptions,
  ): Promise<PullRequestMetadata[]> {
    const authorSet = new Set(options.authors.map(normalizeAuthor));
    const limit = options.limit ?? 10;
    const numbers: number[] = [];

    for (let page = 1; page <= 5 && numbers.length < limit; page += 1) {
      const pulls = await this.request<GitHubPullListResponse[]>(
        `/repos/${repository}/pulls?state=closed&sort=updated&direction=desc&per_page=100&page=${page}`,
      );
      for (const pull of pulls) {
        if (
          pull.merged_at &&
          new Date(pull.merged_at) >= options.since &&
          authorSet.has(normalizeAuthor(pull.user?.login ?? ""))
        ) {
          numbers.push(pull.number);
          if (numbers.length === limit) break;
        }
      }
      if (pulls.length < 100) break;
    }

    const metadata: PullRequestMetadata[] = [];
    for (const number of numbers) {
      metadata.push(await this.getPullRequest(repository, number));
    }
    return metadata.sort(
      (left, right) =>
        new Date(right.mergedAt).getTime() - new Date(left.mergedAt).getTime(),
    );
  }

  private async paginate<T>(path: string): Promise<T[]> {
    const results: T[] = [];

    for (let page = 1; ; page += 1) {
      const separator = path.includes("?") ? "&" : "?";
      const batch = await this.request<T[]>(
        `${path}${separator}per_page=100&page=${page}`,
      );
      results.push(...batch);
      if (batch.length < 100) return results;
    }
  }

  private async request<T>(path: string): Promise<T> {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": API_VERSION,
      "User-Agent": "aftermerge-cli",
    };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;

    const response = await fetch(`https://api.github.com${path}`, { headers });
    if (!response.ok) {
      const details = await response.text();
      throw new Error(
        `GitHub API request failed (${response.status}): ${details.slice(0, 500)}`,
      );
    }
    return (await response.json()) as T;
  }
}

function normalizeAuthor(author: string): string {
  return author.toLowerCase().replace(/\[bot\]$/, "");
}
