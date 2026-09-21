import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
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
  readonly runId: string;
  readonly repository: string | null;
  readonly base: string | null;
  readonly setup: string | null;
  readonly command: string;
  readonly steps: readonly ClaimedCheckStep[];
}

export interface CheckWorkPort {
  claimNext(
    workspaceId: WorkspaceId,
    runner: RunnerId,
    now: Date,
  ): Promise<ClaimedCheck | null>;
}
