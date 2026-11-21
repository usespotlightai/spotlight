import type { ReviewWork } from '@runs/application/ports/review-work.port';
import type { PoolId } from '@shared-kernel/domain/value-objects/pool-id.vo';
import type { ProvisionFailure } from '@shared-kernel/domain/value-objects/provision-failure.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const REVIEW_WORK_PROVISIONING = Symbol('REVIEW_WORK_PROVISIONING');

export interface WaitingReviewWork {
  readonly work: ReviewWork;
  readonly runId: RunId | null;
  readonly placement: RunnerPlacement;
}

export interface ExpiredReviewWork {
  readonly work: ReviewWork;
  readonly runner: RunnerId;
  readonly until: Date;
}

export interface ReviewWorkProvisioningPort {
  awaiting(
    workspaceId: WorkspaceId,
    now: Date,
    page: { readonly skip: number; readonly max: number },
  ): Promise<readonly WaitingReviewWork[]>;

  // The workspaces that have review work that waits for Spotlight to provision a runner now. It leaves out reserved work and work that backs off.
  workspacesAwaiting(now: Date): Promise<readonly WorkspaceId[]>;

  reserve(
    work: ReviewWork,
    runner: RunnerId,
    pool: PoolId,
    now: Date,
  ): Promise<Date | null>;

  unreserve(work: ReviewWork, runner: RunnerId): Promise<void>;

  failed(
    work: ReviewWork,
    runner: RunnerId,
    failure: ProvisionFailure,
    now: Date,
  ): Promise<void>;

  expired(now: Date): Promise<readonly ExpiredReviewWork[]>;
}
