import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import type { WorkAccess } from '@work/application/services/work-access.service';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import { UnknownTaskError } from '@work/domain/exceptions/unknown-task.error';
import type { TaskRepository } from '@work/domain/repositories/task.repository';

// The tasks a person names as blockers: each must exist, on a team they see. Call it in the transaction that saves the blocked task.
export class SeenBlockers {
  constructor(
    private readonly tasks: Pick<TaskRepository, 'blockersAmong'>,
    private readonly lines: Pick<LineMapsPort, 'findByStation'>,
    private readonly access: Pick<WorkAccess, 'seesTeam'>,
  ) {}

  async named(
    ids: readonly string[],
    viewer: UserId,
  ): Promise<readonly Task[]> {
    const blockers = await this.tasks.blockersAmong(
      ids.map((each) => TaskId.of(each)),
    );

    const unknown = ids.find(
      (id) => !blockers.some((each) => each.id.value === id),
    );

    if (unknown !== undefined) {
      throw new UnknownTaskError(unknown);
    }

    for (const blocker of blockers) {
      const line = await this.lines.findByStation(blocker.stationId);

      if (!line || !(await this.access.seesTeam(line.teamId, viewer))) {
        throw new UnknownTaskError(blocker.id.value);
      }
    }

    return blockers;
  }
}
