import type { TaskDispatching } from '@work/application/services/dispatch-task.service';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';

export const handedToRun = async (
  dispatch: TaskDispatching,
  task: Task,
  line: LineMap,
): Promise<Task> => {
  const runId = task.wantsRun(line)
    ? await dispatch.runIdFor({ task, line })
    : null;

  return runId ? task.assignRun(runId, line) : task;
};
