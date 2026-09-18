import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type {
  RunLookup,
  TaskLookup,
  WorkLookupPort,
} from '@work/application/ports/work-lookup.port';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { Concerns } from '@work/domain/value-objects/concerns.vo';
import { Mark } from '@work/domain/value-objects/mark.vo';

export class WorkLookup implements WorkLookupPort {
  constructor(
    private readonly runs: RunRepository,
    private readonly tasks: TaskRepository,
    private readonly lines: LineRepository,
  ) {}

  async run(runId: RunId): Promise<RunLookup | null> {
    const run = await this.runs.findById(runId);

    if (!run) {
      return null;
    }

    const station = run.stationId
      ? (await this.lines.holding(run.stationId))?.stationAt(run.stationId)
      : null;

    return {
      id: run.id,
      workspaceId: run.workspaceId,
      taskId: run.taskId,
      check: station?.check?.value ?? null,
      ended: run.hasEnded,
    };
  }

  async wasWorkedBy(runId: RunId, runner: RunnerId): Promise<boolean> {
    return (await this.runs.findById(runId))?.wasWorkedBy(runner) ?? false;
  }

  async task(taskId: TaskId): Promise<TaskLookup | null> {
    const task = await this.tasks.find(taskId);

    return task ? this.lookup(task) : null;
  }

  async taskWithPullRequest(
    workspaceId: WorkspaceId,
    pullRequest: PullRequestUrl,
  ): Promise<TaskLookup | null> {
    const task =
      (await this.wearing(workspaceId, Mark.pullRequest(pullRequest))) ??
      (await this.wearing(workspaceId, Mark.review(pullRequest)));

    return task ? this.lookup(task) : null;
  }

  private async wearing(
    workspaceId: WorkspaceId,
    mark: Mark,
  ): Promise<Task | null> {
    const concerns = Concerns.of({ marks: [mark] });

    return concerns ? this.tasks.holding(workspaceId, concerns) : null;
  }

  private async lookup(task: Task): Promise<TaskLookup> {
    const line = await this.lines.holding(task.stationId);

    return {
      id: task.id,
      workspaceId: task.workspaceId,
      teamId: line?.teamId ?? null,
      pullRequest: task.pullRequest,
      reviewing: task.reviewing,
      currentRunId: task.currentRunId,
    };
  }
}
