import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import type { TaskLinksPort } from '@work/application/ports/task-links.port';
import type {
  TaskViewDto,
  TaskViewsPort,
} from '@work/application/ports/task-views.port';
import { correlatedTask } from '@work/application/services/correlated-task';
import type { Task } from '@work/domain/aggregates/task.aggregate';
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
  ) {}

  async of(taskId: string, runId: string | null): Promise<TaskViewDto | null> {
    const task = await this.tasks.find(TaskId.of(taskId));

    return task
      ? this.viewOf(task, runId ?? task.currentRunId?.value ?? null)
      : null;
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

    return task ? this.viewOf(task, task.currentRunId?.value ?? null) : null;
  }

  private async viewOf(
    task: Task,
    runId: string | null,
  ): Promise<TaskViewDto | null> {
    const line = await this.lines.findByStation(task.stationId);

    if (!line) {
      return null;
    }

    const station = line.stationAt(task.stationId);
    const slug = await this.workspaces.slugOf(task.workspaceId.value);

    return {
      taskId: task.id.value,
      workspaceId: task.workspaceId.value,
      teamId: line.teamId.value,
      title: task.title.value,
      url: slug
        ? this.links.taskPage(slug, line.teamId.value, task.id.value)
        : '',
      line: line.key.value,
      station: station?.name.value ?? '',
      stationKey: station?.key.value ?? '',
      marks: Object.fromEntries(
        task.marks.map((mark) => [mark.kind, mark.value]),
      ),
      repositories: repositoriesForTask(task, line).map((each) => each.value),
      pullRequest: task.pullRequest?.value ?? null,
      runId,
    };
  }
}
