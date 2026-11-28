import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import { InvalidTaskBlockerError } from '@work/domain/exceptions/invalid-task-blocker.error';
import { TaskBlockingCycleError } from '@work/domain/exceptions/task-blocking-cycle.error';
import { UnknownTaskError } from '@work/domain/exceptions/unknown-task.error';
import type { BlockingGraph } from '@work/domain/services/blocking-graph';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';

// A task named as a blocker, and the line it is on.
export interface Blocker {
  readonly task: Task;
  readonly line: LineMap;
}

// The tasks among `blockers` that block: a completed task blocks nothing, and a deleted one is not among them.
// A task that finished at the end of its line, with its pull request still open, is not completed, so it blocks.
const openAmong = (
  workspaceId: WorkspaceId,
  blockers: readonly Blocker[],
): readonly Task[] =>
  blockers
    .filter(({ task: blocker, line }, at) => {
      if (!blocker.workspaceId.equals(workspaceId)) {
        throw new UnknownTaskError(blocker.id.value);
      }

      return (
        !blocker.completedOn(line) &&
        blockers.findIndex((other) => other.task.id.equals(blocker.id)) === at
      );
    })
    .map((each) => each.task);

export const Blocking = {
  forNewTask(
    workspaceId: WorkspaceId,
    blockers: readonly Blocker[],
  ): readonly TaskId[] {
    return openAmong(workspaceId, blockers).map((each) => each.id);
  },

  // A task cannot wait for itself, nor for a task that waits for it.
  forTask(
    task: Pick<Task, 'id' | 'workspaceId'>,
    blockers: readonly Blocker[],
    graph: BlockingGraph,
  ): readonly TaskId[] {
    const open = openAmong(task.workspaceId, blockers);

    if (open.some((each) => each.id.equals(task.id))) {
      throw new InvalidTaskBlockerError('A task cannot wait for itself.');
    }

    const cycle = open.find((each) => graph.waitsFor(each.id, task.id));

    if (cycle) {
      throw new TaskBlockingCycleError(cycle.title.value);
    }

    return open.map((each) => each.id);
  },
};
