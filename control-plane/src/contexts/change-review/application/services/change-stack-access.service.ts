import type { PeoplePort } from '@change-review/application/ports/people.port';
import type {
  ReviewedRun,
  ReviewedTask,
  WorkPort,
} from '@change-review/application/ports/work.port';
import { TeamAccess } from '@change-review/domain/services/team-access';
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

    if (!run) {
      return null;
    }

    if (run.taskId) {
      return (await this.ofTask(teamId, run.taskId.value, viewerId))
        ? run
        : null;
    }

    if (!run.isReplay && !run.isSearch) {
      return null;
    }

    const [member, ranFor] = await Promise.all([
      this.people.memberOf(teamId, viewerId),
      this.work.teamOfRun(run.id),
    ]);

    return member &&
      TeamAccess.of(member).reaches({
        workspaceId: run.workspaceId,
        teamId: ranFor,
      })
      ? run
      : null;
  }

  async ofTask(
    teamId: string,
    taskId: string,
    viewerId: string,
  ): Promise<ReviewedTask | null> {
    const member = await this.people.memberOf(teamId, viewerId);
    const task = member ? await this.work.task(TaskId.of(taskId)) : null;

    return member && task && TeamAccess.of(member).reaches(task) ? task : null;
  }
}
