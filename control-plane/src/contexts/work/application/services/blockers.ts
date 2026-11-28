import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import { UnknownTaskError } from '@work/domain/exceptions/unknown-task.error';
import type { Blocker } from '@work/domain/services/blocking';

// Each task with the line it is on, so Blocking can tell if it is completed. A task on no line is unknown.
export const blockersOf = async (
  lines: Pick<LineMapsPort, 'findByStation'>,
  tasks: readonly Task[],
): Promise<readonly Blocker[]> => {
  const blockers: Blocker[] = [];

  for (const task of tasks) {
    const line = await lines.findByStation(task.stationId);

    if (!line) {
      throw new UnknownTaskError(task.id.value);
    }

    blockers.push({ task, line });
  }

  return blockers;
};
