import type { PeoplePort } from '@memory/application/ports/people.port';
import type {
  RememberedTask,
  WorkPort,
} from '@memory/application/ports/work.port';
import { TeamAccess } from '@memory/domain/services/team-access';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export interface Reviewing {
  readonly task: RememberedTask;
  readonly access: TeamAccess;
}

export class MemoryAccess {
  constructor(
    private readonly people: PeoplePort,
    private readonly work: WorkPort,
  ) {}

  async forTeam(teamId: string, viewerId: string): Promise<TeamAccess> {
    return TeamAccess.onTeam(
      teamId,
      await this.people.memberOf(teamId, viewerId),
    );
  }

  async ofTask(
    teamId: string,
    taskId: string,
    viewerId: string,
  ): Promise<Reviewing | null> {
    const access = await this.forTeam(teamId, viewerId);
    const task = await this.work.task(TaskId.of(taskId));

    return task && access.reviews(task) ? { task, access } : null;
  }
}
