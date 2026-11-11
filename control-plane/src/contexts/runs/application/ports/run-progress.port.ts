import type {
  RunProgressFact,
  RunStateFact,
  RunTurnFact,
} from '@runs/application/ports/run-facts.port';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export const RUN_PROGRESS = Symbol('RUN_PROGRESS');

export interface RunProgressFacts {
  readonly runId: RunId;
  readonly state: RunStateFact;
  readonly stopRequested: boolean;
  readonly turn: RunTurnFact | null;
  readonly progress: RunProgressFact | null;
  readonly resumable: boolean;
  readonly suspendedAt: Date | null;
  readonly queuedAt: Date;
}

export interface RunProgressPort {
  progressOf(runIds: readonly RunId[]): Promise<readonly RunProgressFacts[]>;
}
