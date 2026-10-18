import type { PoolId } from '@shared-kernel/domain/value-objects/pool-id.vo';
import type { ProvisionFailure } from '@shared-kernel/domain/value-objects/provision-failure.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const CHECK_PROVISIONING = Symbol('CHECK_PROVISIONING');

export interface WaitingCheck {
  readonly stackId: string;
  readonly runId: string;
  readonly placement: RunnerPlacement;
}

export interface ExpiredCheck {
  readonly stackId: string;
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
    stackId: string,
    runner: RunnerId,
    pool: PoolId,
    now: Date,
  ): Promise<Date | null>;

  unreserve(stackId: string, runner: RunnerId): Promise<void>;

  failed(
    stackId: string,
    runner: RunnerId,
    failure: ProvisionFailure,
    now: Date,
  ): Promise<void>;

  expired(now: Date): Promise<readonly ExpiredCheck[]>;
}
