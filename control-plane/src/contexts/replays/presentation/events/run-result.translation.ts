import type { RunResult } from '@replays/domain/value-objects/replay-ending';
import type { RunOutcomePublished } from '@shared-kernel/application/integration-events/run-ended.integration-event';

const RUN_RESULT: Readonly<Record<RunOutcomePublished, RunResult>> = {
  completed: 'completed',
  failed: 'failed',
  exhausted: 'exhausted',
  cancelled: 'cancelled',
};

export const runResultOf = (outcome: RunOutcomePublished): RunResult =>
  RUN_RESULT[outcome];
