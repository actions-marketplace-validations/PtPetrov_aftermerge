import type { AddedRange, CommitSignal, LineIdentity } from "./types.js";
export declare class GitRepository {
    readonly directory: string;
    private readonly temporary;
    private constructor();
    static clonePublic(repository: string, branch: string): Promise<GitRepository>;
    static open(directory: string): GitRepository;
    dispose(): Promise<void>;
    ensureCommit(sha: string): Promise<void>;
    resolve(revision: string): Promise<string>;
    resolveFirst(revisions: string[]): Promise<string>;
    firstParent(commit: string): Promise<string>;
    addedRanges(parent: string, commit: string): Promise<AddedRange[]>;
    blame(commit: string, path: string): Promise<LineIdentity[]>;
    commitAtOrBefore(head: string, date: Date, floor: string): Promise<string>;
    commitDate(commit: string): Promise<string>;
    signals(baseline: string, target: string, paths: string[], knownShas: string[]): Promise<{
        explicitReverts: CommitSignal[];
        likelyFixes: CommitSignal[];
    }>;
    private isAncestor;
    private hasObject;
    private run;
}
export declare function parseAddedRanges(diff: string): AddedRange[];
export declare function parseBlame(output: string, path: string): LineIdentity[];
//# sourceMappingURL=git.d.ts.map