import type { Task } from '@work/domain/aggregates/task.aggregate';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import { isQueued } from '@work/domain/value-objects/run-state';

export const queuedOf = async (
  runs: RunRepository,
  task: Task,
): Promise<boolean> => {
  const runId = task.working ? task.currentRunId : null;
  const current = runId ? await runs.findById(runId) : null;

  return current ? isQueued(current.state, current.stopRequested) : false;
};
