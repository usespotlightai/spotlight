import type {
  RunProgressFact,
  RunStateFact,
  RunTurnFact,
} from '@runs/application/ports/run-facts.port';
import { progressOf, resumable } from '@runs/domain/value-objects/run-state';

export interface RunWorking {
  readonly state: RunStateFact;
  readonly stopRequested: boolean;
  readonly turn?: RunTurnFact | null;
}

export const RunProgressContract = {
  of(run: RunWorking): RunProgressFact | null {
    return progressOf(run);
  },

  reading(run: RunWorking | null): {
    readonly progress: RunProgressFact | null;
    readonly resumable: boolean;
  } | null {
    return run
      ? {
          progress: progressOf(run),
          resumable: resumable(run.state, run.stopRequested, run.turn ?? null),
        }
      : null;
  },
};
