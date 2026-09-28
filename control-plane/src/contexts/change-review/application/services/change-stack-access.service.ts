import type { PeoplePort } from '@change-review/application/ports/people.port';
import type {
  ReviewedRun,
  ReviewedTask,
  WorkPort,
} from '@change-review/application/ports/work.port';
import { ReviewClearance } from '@change-review/domain/services/review-clearance';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export class ChangeStackAccess {
  constructor(
    private readonly people: PeoplePort,
    private readonly work: WorkPort,
  ) {}

  async ofRun(
    teamId: string,
    runId: string,
    viewerId: string,
  ): Promise<ReviewedRun | null> {
    const run = await this.work.run(RunId.of(runId));
    const task = run?.taskId
      ? await this.ofTask(teamId, run.taskId.value, viewerId)
      : null;

    return task ? run : null;
  }

  async ofTask(
    teamId: string,
    taskId: string,
    viewerId: string,
  ): Promise<ReviewedTask | null> {
    const member = await this.people.memberOf(teamId, viewerId);
    const task = member ? await this.work.task(TaskId.of(taskId)) : null;

    return member && task && ReviewClearance.of(member).reaches(task)
      ? task
      : null;
  }
}
