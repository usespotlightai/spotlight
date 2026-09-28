import type { PeoplePort } from '@change-review/application/ports/people.port';
import type {
  ReviewedTask,
  WorkPort,
} from '@change-review/application/ports/work.port';
import { ReviewClearance } from '@change-review/domain/services/review-clearance';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export interface Deciding {
  readonly task: ReviewedTask;
  readonly by: UserId;
}

export class DecisionAccess {
  constructor(
    private readonly people: PeoplePort,
    private readonly work: WorkPort,
  ) {}

  async ofTask(
    teamId: string,
    taskId: string,
    viewerId: string,
  ): Promise<Deciding | null> {
    const member = await this.people.memberOf(teamId, viewerId);
    const task = member ? await this.work.task(TaskId.of(taskId)) : null;

    if (!member || !task || !ReviewClearance.of(member).reaches(task)) {
      return null;
    }

    return { task, by: member.by };
  }
}
