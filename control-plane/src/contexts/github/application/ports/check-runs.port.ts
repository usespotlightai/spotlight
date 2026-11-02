import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface FailedCheckDto {
  readonly name: string;
  readonly conclusion: string;
  readonly url: string | null;
  readonly step: string | null;
  readonly summary: string | null;
  readonly log: string | null;
}

export interface FailedChecksDto {
  readonly commit: string;
  readonly failed: readonly FailedCheckDto[];
}

export const CHECK_RUNS = Symbol('CHECK_RUNS');

export interface CheckRunsPort {
  failedOn(
    workspaceId: WorkspaceId,
    pullRequest: PullRequestUrl,
  ): Promise<FailedChecksDto>;

  failedInSuite(
    workspaceId: WorkspaceId,
    repository: Repository,
    suite: number,
  ): Promise<readonly string[]>;
}
