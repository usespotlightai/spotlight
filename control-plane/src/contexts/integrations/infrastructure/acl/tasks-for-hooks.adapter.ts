import type {
  TasksForHooksPort,
  TaskView,
} from '@integrations/application/ports/tasks-for-hooks.port';
import { TaskViewMapper } from '@integrations/infrastructure/acl/task-view.mapper';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { TaskViewsPort } from '@work/application/ports/task-views.port';

export class TasksForHooks implements TasksForHooksPort {
  constructor(private readonly tasks: TaskViewsPort) {}

  async of(taskId: TaskId, runId: RunId | null): Promise<TaskView | null> {
    const task = await this.tasks.of(taskId.value, runId?.value ?? null);

    return task ? TaskViewMapper.toView(task) : null;
  }

  async ofPullRequest(
    workspaceId: WorkspaceId,
    pullRequest: PullRequestUrl,
  ): Promise<TaskView | null> {
    const task = await this.tasks.ofPullRequest(
      workspaceId.value,
      pullRequest.value,
    );

    return task ? TaskViewMapper.toView(task) : null;
  }
}
