import type { RunResult } from '@replays/domain/value-objects/replay-ending';
import type { RunEnding } from '@shared-kernel/application/integration-events/run-ended.integration-event';

const RUN_RESULT: Readonly<Record<RunEnding, RunResult>> = {
  completed: 'completed',
  failed: 'failed',
  exhausted: 'exhausted',
  cancelled: 'cancelled',
};

export const runResultOf = (ending: RunEnding): RunResult => RUN_RESULT[ending];
