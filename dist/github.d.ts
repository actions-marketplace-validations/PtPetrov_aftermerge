import type { PullRequestMetadata } from "./types.js";
export interface DiscoverOptions {
    since: Date;
    authors: string[];
    limit?: number;
}
export declare class GitHubClient {
    private readonly token?;
    constructor(token?: string | undefined);
    getPullRequest(repository: string, number: number): Promise<PullRequestMetadata>;
    discoverMergedPullRequests(repository: string, options: DiscoverOptions): Promise<PullRequestMetadata[]>;
    private paginate;
    private request;
}
//# sourceMappingURL=github.d.ts.map