import type { CheckWorkId } from '@shared-kernel/domain/value-objects/check-work-id.vo';
import type { PoolId } from '@shared-kernel/domain/value-objects/pool-id.vo';
import type { ProvisionFailure } from '@shared-kernel/domain/value-objects/provision-failure.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const CHECK_PROVISIONING = Symbol('CHECK_PROVISIONING');

export interface WaitingCheck {
  readonly checkId: CheckWorkId;
  readonly runId: RunId;
  readonly placement: RunnerPlacement;
}

export interface ExpiredCheck {
  readonly checkId: CheckWorkId;
  readonly runner: RunnerId;
  readonly until: Date;
}

export interface CheckProvisioningPort {
  awaiting(
    workspaceId: WorkspaceId,
    now: Date,
    page: { readonly skip: number; readonly max: number },
  ): Promise<readonly WaitingCheck[]>;

  reserve(
    checkId: CheckWorkId,
    runner: RunnerId,
    pool: PoolId,
    now: Date,
  ): Promise<Date | null>;

  unreserve(checkId: CheckWorkId, runner: RunnerId): Promise<void>;

  failed(
    checkId: CheckWorkId,
    runner: RunnerId,
    failure: ProvisionFailure,
    now: Date,
  ): Promise<void>;

  expired(now: Date): Promise<readonly ExpiredCheck[]>;
}
