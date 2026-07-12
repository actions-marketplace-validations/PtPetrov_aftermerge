export interface PullRequestMetadata {
  repository: string;
  number: number;
  title: string;
  url: string;
  author: string;
  mergedAt: string;
  mergeCommitSha: string;
  baseRef: string;
  baseSha: string;
  headSha: string;
  commitShas: string[];
  labels: string[];
}

export interface AddedRange {
  path: string;
  start: number;
  count: number;
}

export interface LineIdentity {
  path: string;
  commit: string;
  originalLine: number;
  finalLine: number;
  content: string;
}

export interface CommitSignal {
  sha: string;
  subject: string;
  committedAt: string;
}

export interface HorizonResult {
  days: number;
  status: "ready" | "pending";
  targetDate: string;
  targetCommit?: string;
  trackedLines: number;
  survivingLines?: number;
  survivalRate?: number;
  turnoverRate?: number;
  explicitReverts: CommitSignal[];
  likelyFixes: CommitSignal[];
}

export interface DurabilityReport {
  schemaVersion: 1;
  generatedAt: string;
  pullRequest: PullRequestMetadata;
  baselineCommit: string;
  baselineParent: string;
  trackedFiles: string[];
  trackedLines: number;
  horizons: HorizonResult[];
  limitations: string[];
}
