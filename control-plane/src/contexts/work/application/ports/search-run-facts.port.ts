import type { RunState } from '@work/domain/value-objects/run-state';

export interface SearchRunFact {
  readonly runId: string;
  readonly state: RunState;
  readonly askedAPerson: boolean;
  readonly attempt: number;
  readonly queuedAt: Date;
  readonly startedAt: Date | null;
  readonly endedAt: Date | null;
}

export interface SearchRunFactsPort {
  of(runIds: readonly string[]): Promise<readonly SearchRunFact[]>;
}
