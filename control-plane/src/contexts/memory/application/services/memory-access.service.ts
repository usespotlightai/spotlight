import type { PeoplePort } from '@memory/application/ports/people.port';
import type {
  RememberedTask,
  WorkPort,
} from '@memory/application/ports/work.port';
import { MemoryClearance } from '@memory/domain/services/memory-clearance';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export interface Reviewing {
  readonly task: RememberedTask;
  readonly clearance: MemoryClearance;
}

export class MemoryAccess {
  constructor(
    private readonly people: PeoplePort,
    private readonly work: WorkPort,
  ) {}

  async clearance(teamId: string, viewerId: string): Promise<MemoryClearance> {
    return MemoryClearance.onTeam(
      teamId,
      await this.people.memberOf(teamId, viewerId),
    );
  }

  async ofTask(
    teamId: string,
    taskId: string,
    viewerId: string,
  ): Promise<Reviewing | null> {
    const clearance = await this.clearance(teamId, viewerId);
    const task = await this.work.task(TaskId.of(taskId));

    return task && clearance.reviews(task) ? { task, clearance } : null;
  }
}
