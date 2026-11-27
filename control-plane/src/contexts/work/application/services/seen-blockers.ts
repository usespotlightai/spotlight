import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import type { WorkAccess } from '@work/application/services/work-access.service';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import { UnknownTaskError } from '@work/domain/exceptions/unknown-task.error';
import type { TaskRepository } from '@work/domain/repositories/task.repository';

const foundBlockers = async (
  tasks: Pick<TaskRepository, 'find'>,
  ids: readonly string[],
): Promise<readonly Task[]> =>
  Promise.all(
    [...new Set(ids)].map(async (id) => {
      const found = await tasks.find(TaskId.of(id));

      if (!found) {
        throw new UnknownTaskError(id);
      }

      return found;
    }),
  );

// The tasks a person names as blockers, each on a team they see.
export class SeenBlockers {
  constructor(
    private readonly tasks: Pick<TaskRepository, 'find'>,
    private readonly lines: Pick<LineMapsPort, 'findByStation'>,
    private readonly access: Pick<WorkAccess, 'seesTeam'>,
  ) {}

  async named(
    ids: readonly string[],
    viewer: UserId,
  ): Promise<readonly Task[]> {
    const blockers = await foundBlockers(this.tasks, ids);

    for (const blocker of blockers) {
      const line = await this.lines.findByStation(blocker.stationId);

      if (!line || !(await this.access.seesTeam(line.teamId, viewer))) {
        throw new UnknownTaskError(blocker.id.value);
      }
    }

    return blockers;
  }
}
