import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunStateFact } from '@work/application/ports/run-facts.port';
import type { RunTurnState } from '@work/domain/value-objects/run-turn.vo';

export const RUN_PROGRESS = Symbol('RUN_PROGRESS');

export interface RunProgressFacts {
  readonly runId: RunId;
  readonly state: RunStateFact;
  readonly stopRequested: boolean;
  readonly turn: RunTurnState | null;
  readonly suspendedAt: Date | null;
  readonly queuedAt: Date;
}

export interface RunProgressPort {
  progressOf(runIds: readonly RunId[]): Promise<readonly RunProgressFacts[]>;
}
