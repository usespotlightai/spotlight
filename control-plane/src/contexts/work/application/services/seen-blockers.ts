import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import { blockersOf } from '@work/application/services/blockers';
import type { WorkAccess } from '@work/application/services/work-access.service';
import { UnknownTaskError } from '@work/domain/exceptions/unknown-task.error';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import type { Blocker } from '@work/domain/services/blocking';

export class SeenBlockers {
  constructor(
    private readonly tasks: Pick<TaskRepository, 'blockersAmong'>,
    private readonly lines: Pick<LineMapsPort, 'findByStation'>,
    private readonly access: Pick<WorkAccess, 'seesTeam'>,
  ) {}

  async named(
    ids: readonly string[],
    viewer: UserId,
  ): Promise<readonly Blocker[]> {
    const tasks = await this.tasks.blockersAmong(
      ids.map((each) => TaskId.of(each)),
    );

    const unknown = ids.find(
      (id) => !tasks.some((each) => each.id.value === id),
    );

    if (unknown !== undefined) {
      throw new UnknownTaskError(unknown);
    }

    const blockers = await blockersOf(this.lines, tasks);

    for (const { task, line } of blockers) {
      if (!(await this.access.seesTeam(line.teamId, viewer))) {
        throw new UnknownTaskError(task.id.value);
      }
    }

    return blockers;
  }
}
