import type {
  TasksForHooksPort,
  TaskView,
} from '@integrations/application/ports/tasks-for-hooks.port';
import { TaskViewMapper } from '@integrations/infrastructure/acl/task-view.mapper';
import type { TaskViewsPort } from '@work/application/ports/task-views.port';

export class TasksForHooks implements TasksForHooksPort {
  constructor(private readonly tasks: TaskViewsPort) {}

  async of(taskId: string, runId: string | null): Promise<TaskView | null> {
    const task = await this.tasks.of(taskId, runId);

    return task ? TaskViewMapper.toView(task) : null;
  }

  async ofPullRequest(
    workspaceId: string,
    pullRequest: string,
  ): Promise<TaskView | null> {
    const task = await this.tasks.ofPullRequest(workspaceId, pullRequest);

    return task ? TaskViewMapper.toView(task) : null;
  }
}
