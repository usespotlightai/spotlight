import type { PeoplePort } from '@memory/application/ports/people.port';
import type {
  RememberedTask,
  WorkPort,
} from '@memory/application/ports/work.port';
import { TeamAccess } from '@memory/domain/services/team-access';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export interface Reviewing {
  readonly task: RememberedTask;
  readonly access: TeamAccess;
}

export class MemoryAccess {
  constructor(
    private readonly people: PeoplePort,
    private readonly work: WorkPort,
  ) {}

  async forTeam(teamId: TeamId, viewerId: UserId): Promise<TeamAccess> {
    return TeamAccess.onTeam(
      teamId,
      await this.people.viewerOf(teamId, viewerId),
    );
  }

  async ofTask(
    teamId: TeamId,
    taskId: TaskId,
    viewerId: UserId,
  ): Promise<Reviewing | null> {
    const access = await this.forTeam(teamId, viewerId);
    const task = await this.work.task(taskId);

    return task && access.reviews(task) ? { task, access } : null;
  }
}
