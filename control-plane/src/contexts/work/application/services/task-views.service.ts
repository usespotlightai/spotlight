import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import type { TaskLinksPort } from '@work/application/ports/task-links.port';
import type {
  TaskViewDto,
  TaskViewsPort,
} from '@work/application/ports/task-views.port';
import { correlatedTask } from '@work/application/services/correlated-task';
import type { IntegrationTaskViews } from '@work/application/services/integration-task-views.service';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import type { DispatchRepository } from '@work/domain/repositories/dispatch.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { repositoriesForTask } from '@work/domain/services/task-checkouts';
import { CorrelationKeys } from '@work/domain/value-objects/correlation-keys.vo';
import { Mark } from '@work/domain/value-objects/mark.vo';

export class TaskViews implements TaskViewsPort {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly lines: LineMapsPort,
    private readonly workspaces: WorkspaceReaderPort,
    private readonly links: TaskLinksPort,
    private readonly dispatches: DispatchRepository,
    private readonly views: IntegrationTaskViews,
  ) {}

  async of(taskId: string, runId: string | null): Promise<TaskViewDto | null> {
    const task = await this.tasks.find(TaskId.of(taskId));

    if (!task) {
      return null;
    }

    const subject = runId
      ? (await this.dispatches.find(RunId.of(runId)))?.subject
      : null;

    return this.viewOf(
      task,
      runId ?? task.currentRunId?.value ?? null,
      subject?.kind === 'task' && subject.taskId.equals(task.id)
        ? subject.stationId
        : task.stationId,
    );
  }

  async ofPullRequest(
    workspaceId: string,
    pullRequest: string,
  ): Promise<TaskViewDto | null> {
    const correlationKeys = CorrelationKeys.of({
      marks: [Mark.pullRequest(PullRequestUrl.of(pullRequest))],
    });
    const task = correlationKeys
      ? await correlatedTask(
          this.tasks,
          WorkspaceId.of(workspaceId),
          correlationKeys,
        )
      : null;

    return task
      ? this.viewOf(task, task.currentRunId?.value ?? null, task.stationId)
      : null;
  }

  private async viewOf(
    task: Task,
    runId: string | null,
    stationId: StationId,
  ): Promise<TaskViewDto | null> {
    const line = await this.lines.findByStation(stationId);

    if (!line) {
      return null;
    }

    const slug = await this.workspaces.slugOf(task.workspaceId);

    return {
      ...(await this.views.seen(task, line, stationId)),
      url: slug
        ? this.links.taskPage(slug, line.teamId.value, task.id.value)
        : '',
      repositories: repositoriesForTask(task, line).map((each) => each.value),
      runId,
    };
  }
}
