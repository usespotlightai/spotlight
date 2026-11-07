import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { Handover } from '@work/domain/value-objects/handover.vo';
import type { HarnessSession } from '@work/domain/value-objects/harness-session.vo';
import type { RunOutcome } from '@work/domain/value-objects/run-outcome.vo';
import type { RunTurnState } from '@work/domain/value-objects/run-turn.vo';

export const RUN_TURNS = Symbol('RUN_TURNS');

export interface TurnFacts {
  readonly runId: RunId;
  readonly workspaceId: WorkspaceId;
  readonly attempt: number;
  readonly turn: RunTurnState;
  readonly outcome: RunOutcome;
  readonly handover: Handover | null;
  readonly session: HarnessSession | null;
  readonly reportedBy: RunnerId;
  readonly suspendedAt: Date;
  readonly stopRequested: boolean;
}

export interface TurnsCursor {
  readonly suspendedAt: Date;
  readonly runId: RunId;
}

export interface RunTurnsPort {
  turnOf(runId: RunId, attempt: number): Promise<TurnFacts | null>;

  ofTasksOlderThan(
    turn: RunTurnState,
    before: Date,
    after: TurnsCursor | null,
    max: number,
  ): Promise<readonly TurnFacts[]>;
}
