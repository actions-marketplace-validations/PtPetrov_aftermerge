#!/usr/bin/env node

import { resolve } from "node:path";
import { analyzePullRequest } from "./analyzer.js";
import { GitHubClient } from "./github.js";
import { GitRepository } from "./git.js";
import { renderMarkdown, renderPortfolioMarkdown } from "./report.js";

const DEFAULT_AUTHORS = [
  "Copilot",
  "copilot-swe-agent[bot]",
  "openai-codex[bot]",
  "devin-ai-integration[bot]",
  "sweep-ai[bot]",
];

interface SharedOptions {
  repository: string;
  token?: string;
  local?: string;
  json: boolean;
}

interface AnalyzeOptions extends SharedOptions {
  command: "analyze";
  pullRequest: number;
}

interface ScanOptions extends SharedOptions {
  command: "scan";
  sinceDays: number;
  authors: string[];
  limit: number;
}

type CliOptions = AnalyzeOptions | ScanOptions;

function usage(): never {
  console.error(`Usage:
  aftermerge analyze owner/repo --pr <number> [--json] [--token <token>]
  aftermerge scan owner/repo --local <path> [--since-days 90] [--authors a,b] [--limit 10]

Environment:
  GITHUB_TOKEN  Optional token for higher API limits or private metadata.`);
  process.exit(1);
}

function positiveInteger(value: string | undefined): number | undefined {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function parseArguments(argv: string[]): CliOptions {
  const [command, repository, ...rest] = argv;
  if (
    (command !== "analyze" && command !== "scan") ||
    !repository ||
    !repository.includes("/")
  ) usage();

  let pullRequest: number | undefined;
  let token = process.env.GITHUB_TOKEN;
  let local: string | undefined;
  let json = false;
  let sinceDays = 90;
  let authors = DEFAULT_AUTHORS;
  let limit = 10;

  for (let index = 0; index < rest.length; index += 1) {
    const argument = rest[index];
    if (argument === "--json") {
      json = true;
    } else if (argument === "--pr") {
      pullRequest = positiveInteger(rest[index + 1]);
      index += 1;
    } else if (argument === "--token") {
      token = rest[index + 1];
      index += 1;
    } else if (argument === "--local") {
      local = rest[index + 1];
      index += 1;
    } else if (argument === "--since-days") {
      sinceDays = positiveInteger(rest[index + 1]) ?? usage();
      index += 1;
    } else if (argument === "--authors") {
      authors = (rest[index + 1] ?? "").split(",").map((item) => item.trim()).filter(Boolean);
      if (authors.length === 0) usage();
      index += 1;
    } else if (argument === "--limit") {
      limit = positiveInteger(rest[index + 1]) ?? usage();
      index += 1;
    } else {
      usage();
    }
  }

  const shared = {
    repository,
    ...(token ? { token } : {}),
    ...(local ? { local } : {}),
    json,
  };
  if (command === "analyze") {
    if (!pullRequest) usage();
    return { command, ...shared, pullRequest };
  }
  if (pullRequest) usage();
  return { command, ...shared, sinceDays, authors, limit };
}

async function main(): Promise<void> {
  const options = parseArguments(process.argv.slice(2));
  const client = new GitHubClient(options.token);

  if (options.command === "analyze") {
    const pullRequest = await client.getPullRequest(
      options.repository,
      options.pullRequest,
    );
    const repository = options.local
      ? GitRepository.open(resolve(options.local))
      : await GitRepository.clonePublic(options.repository, pullRequest.baseRef);
    try {
      const report = await analyzePullRequest(repository, pullRequest);
      process.stdout.write(
        options.json ? `${JSON.stringify(report, null, 2)}\n` : `${renderMarkdown(report)}\n`,
      );
    } finally {
      await repository.dispose();
    }
    return;
  }

  const since = new Date(Date.now() - options.sinceDays * 24 * 60 * 60 * 1000);
  const pullRequests = await client.discoverMergedPullRequests(options.repository, {
    since,
    authors: options.authors,
    limit: options.limit,
  });
  if (pullRequests.length === 0) {
    process.stdout.write(
      options.json ? "[]\n" : `${renderPortfolioMarkdown([])}\n`,
    );
    return;
  }

  const repository = options.local
    ? GitRepository.open(resolve(options.local))
    : await GitRepository.clonePublic(options.repository, pullRequests[0]!.baseRef);
  try {
    const reports = [];
    for (const pullRequest of pullRequests) {
      reports.push(await analyzePullRequest(repository, pullRequest));
    }
    process.stdout.write(
      options.json
        ? `${JSON.stringify(reports, null, 2)}\n`
        : `${renderPortfolioMarkdown(reports)}\n`,
    );
  } finally {
    await repository.dispose();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`aftermerge: ${message}`);
  process.exitCode = 1;
});
