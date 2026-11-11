import type {
  ReviewedTask,
  RunForReview,
  RunReasoning,
  WorkPort,
} from '@change-review/application/ports/work.port';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { WorkRunLookupPort } from '@work/application/ports/work-run-lookup.port';
import type {
  TaskLookup,
  WorkTaskLookupPort,
} from '@work/application/ports/work-task-lookup.port';

const reviewed = (task: TaskLookup): ReviewedTask => ({
  id: task.id,
  workspaceId: task.workspaceId,
  teamId: task.teamId,
  pullRequests: task.pullRequests,
  openPullRequests: task.openPullRequests,
  reviewedPullRequest: task.reviewedPullRequest,
  reviewing: task.reviewedPullRequest !== null,
  currentRunId: task.currentRunId,
});

export class Work implements WorkPort {
  constructor(
    private readonly work: WorkRunLookupPort,
    private readonly tasks: WorkTaskLookupPort,
  ) {}

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
        trial: run.trial,
        isolated: run.isolated,
        checkouts: run.checkouts,
      }
    );
  }

  async teamOfRun(runId: RunId): Promise<TeamId | null> {
    return (await this.work.contextOfRun(runId))?.teamId ?? null;
  }

  async reasoning(runId: RunId): Promise<RunReasoning | null> {
    const reasoning = await this.work.reasoning(runId);

    return (
      reasoning && {
        steps: reasoning.steps.map((step) => ({
          index: step.index,
          kind: step.kind,
          text: step.text,
        })),
        changed: [...reasoning.changed],
      }
    );
  }

  async task(taskId: TaskId): Promise<ReviewedTask | null> {
    const task = await this.tasks.task(taskId);
    return task && reviewed(task);
  }

  async taskWithPullRequest(
    workspaceId: WorkspaceId,
    pullRequest: PullRequestUrl,
  ): Promise<ReviewedTask | null> {
    const task = await this.tasks.taskWithPullRequest(workspaceId, pullRequest);
    return task && reviewed(task);
  }
}
