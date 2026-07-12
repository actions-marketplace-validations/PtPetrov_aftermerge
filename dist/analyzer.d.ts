import type { DurabilityReport, FileCategory, PullRequestMetadata } from "./types.js";
import { GitRepository } from "./git.js";
export declare function classifyPath(path: string): FileCategory;
export interface AnalyzeOptions {
    horizons?: number[];
    now?: Date;
    head?: string;
}
export declare function analyzePullRequest(repository: GitRepository, pullRequest: PullRequestMetadata, options?: AnalyzeOptions): Promise<DurabilityReport>;
//# sourceMappingURL=analyzer.d.ts.map