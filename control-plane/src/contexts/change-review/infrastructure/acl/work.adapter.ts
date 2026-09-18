import type {
  ReviewedRun,
  ReviewedTask,
  WorkPort,
} from '@change-review/application/ports/work.port';
import { StackCheck } from '@change-review/domain/value-objects/stack-check.vo';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type {
  TaskLookup,
  WorkLookupPort,
} from '@work/application/ports/work-lookup.port';

const reviewed = (task: TaskLookup): ReviewedTask => ({
  id: task.id,
  workspaceId: task.workspaceId,
  teamId: task.teamId,
  pullRequest: task.pullRequest,
  reviewing: task.reviewing,
  currentRunId: task.currentRunId,
});

export class Work implements WorkPort {
  constructor(private readonly work: WorkLookupPort) {}

  async run(runId: RunId): Promise<ReviewedRun | null> {
    const run = await this.work.run(runId);

    return (
      run && {
        id: run.id,
        workspaceId: run.workspaceId,
        taskId: run.taskId,
        check: run.check?.trim() ? StackCheck.named(run.check) : null,
        ended: run.ended,
      }
    );
  }

  wasWorkedBy(runId: RunId, runner: RunnerId): Promise<boolean> {
    return this.work.wasWorkedBy(runId, runner);
  }

  async task(taskId: TaskId): Promise<ReviewedTask | null> {
    const task = await this.work.task(taskId);
    return task && reviewed(task);
  }

  async taskWithPullRequest(
    workspaceId: WorkspaceId,
    pullRequest: PullRequestUrl,
  ): Promise<ReviewedTask | null> {
    const task = await this.work.taskWithPullRequest(workspaceId, pullRequest);
    return task && reviewed(task);
  }
}
