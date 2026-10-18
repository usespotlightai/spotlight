import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { RunnerOffer } from '@shared-kernel/domain/value-objects/runner-offer.vo';
import type { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const CHECK_WORK = Symbol('CHECK_WORK');

interface ClaimedCheckStep {
  readonly id: string;
  readonly patch: string;
  readonly stopsOnFailure: boolean;
  readonly runsSetup: boolean;
}

export interface ClaimedCheck {
  readonly stackId: string;
  readonly recheck: boolean;
  readonly runId: string;
  readonly repository: string | null;
  readonly base: string | null;
  readonly setup: string | null;
  readonly command: string;
  readonly steps: readonly ClaimedCheckStep[];
}

export type CheckLeaseRenewal = 'renewed' | 'stop';

export interface CheckWorkPort {
  claimNext(
    workspaceId: WorkspaceId,
    runner: RunnerId,
    offer: RunnerOffer,
    now: Date,
  ): Promise<ClaimedCheck | null>;

  claimReserved(
    runner: RunnerId,
    offer: RunnerOffer,
    now: Date,
  ): Promise<ClaimedCheck | null>;

  unclaim(
    stackId: string,
    recheck: boolean,
    runner: RunnerId,
    now: Date,
  ): Promise<void>;

  renewLease(
    runId: RunId,
    stackId: string,
    recheck: boolean,
    runner: RunnerId,
    now: Date,
  ): Promise<CheckLeaseRenewal>;

  waitingPlacements(
    workspaceId: WorkspaceId,
    now: Date,
  ): Promise<readonly RunnerPlacement[]>;
}
