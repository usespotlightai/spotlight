import type { RunTurnFact } from '@runs/application/ports/run-facts.port';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const RUN_TURNS = Symbol('RUN_TURNS');

export interface TurnOutcomeFacts {
  readonly exitCode: number;
  readonly failure: string | null;
  readonly message: string | null;
  readonly stopped: boolean;
}

export interface TurnFileFacts {
  readonly id: string;
  readonly name: string;
  readonly contentType: string;
  readonly size: number;
}

export interface TurnHandoverFacts {
  readonly next: string;
  readonly note: string;
  readonly files: readonly TurnFileFacts[];
}

export interface TurnFacts {
  readonly runId: RunId;
  readonly workspaceId: WorkspaceId;
  readonly attempt: number;
  readonly turn: RunTurnFact;
  readonly outcome: TurnOutcomeFacts;
  readonly handover: TurnHandoverFacts | null;
  readonly session: string | null;
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

  olderThan(
    owner: string,
    turn: RunTurnFact,
    before: Date,
    after: TurnsCursor | null,
    max: number,
  ): Promise<readonly TurnFacts[]>;
}
