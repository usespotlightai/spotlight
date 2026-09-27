import type { PeoplePort } from '@memory/application/ports/people.port';
import type {
  RememberedTask,
  WorkPort,
} from '@memory/application/ports/work.port';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export interface Reviewing {
  readonly task: RememberedTask;
  readonly by: UserId;
}

export class MemoryAccess {
  constructor(
    private readonly people: PeoplePort,
    private readonly work: WorkPort,
  ) {}

  async ofTask(
    teamId: string,
    taskId: string,
    viewerId: string,
  ): Promise<Reviewing | null> {
    const member = await this.people.memberOf(teamId, viewerId);
    const task = member ? await this.work.task(TaskId.of(taskId)) : null;

    if (
      !member ||
      !task?.workspaceId.equals(member.workspaceId) ||
      task.teamId?.value !== teamId
    ) {
      return null;
    }

    return { task, by: member.by };
  }
}
