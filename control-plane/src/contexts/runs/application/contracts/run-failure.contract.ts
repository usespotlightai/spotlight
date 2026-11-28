import { RunFailure } from '@runs/domain/value-objects/run-failure.vo';

/** Why a run failed: in its own work, or for a reason outside it that no change to what it was asked can fix. */
export type RunEndingCauseContract =
  | 'work'
  | 'refused'
  | 'setup'
  | 'infrastructure'
  | 'cancelled';

export interface RunEndingContract {
  readonly cancelled: boolean;
  readonly failure: string | null;
}

/** Why a run that ended so failed; null for a run that did not fail, or a failure code that is not the run's own. */
export const runEndingCauseOf = (
  ending: RunEndingContract,
): RunEndingCauseContract | null => RunFailure.causeOfEnding(ending);
