import type {
  ReviewedTask,
  RunForReview,
  RunReasoning,
  WorkPort,
} from '@change-review/application/ports/work.port';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
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

  async run(runId: RunId): Promise<RunForReview | null> {
    const run = await this.work.run(runId);

    return (
      run && {
        id: run.id,
        workspaceId: run.workspaceId,
        taskId: run.taskId,
        checking:
          run.check !== null
            ? {
                command: run.check,
                setups: run.setups,
                placement: run.placement,
              }
            : null,
        ended: run.ended,
        completed: run.completed,
        decisions: run.decisions,
        isReplay: run.replay,
        isSearch: run.isSearch,
      }
    );
  }

  async teamOfRun(runId: RunId): Promise<TeamId | null> {
    return (await this.work.siteOfRun(runId))?.teamId ?? null;
  }

  wasWorkedBy(runId: RunId, runner: RunnerId): Promise<boolean> {
    return this.work.wasWorkedBy(runId, runner);
  }

  reasoning(runId: RunId): Promise<RunReasoning | null> {
    return this.work.reasoning(runId);
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
