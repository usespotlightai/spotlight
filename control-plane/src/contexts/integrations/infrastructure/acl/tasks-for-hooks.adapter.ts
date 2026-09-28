import type {
  HookedTask,
  TasksForHooksPort,
} from '@integrations/application/ports/tasks-for-hooks.port';
import { HookedTaskMapper } from '@integrations/infrastructure/acl/hooked-task.mapper';
import type { HookedTasksPort } from '@work/application/ports/hooked-tasks.port';

export class TasksForHooks implements TasksForHooksPort {
  constructor(private readonly tasks: HookedTasksPort) {}

  async of(taskId: string, runId: string | null): Promise<HookedTask | null> {
    const task = await this.tasks.of(taskId, runId);

    return task ? HookedTaskMapper.toHooked(task) : null;
  }

  async ofPullRequest(
    workspaceId: string,
    pullRequest: string,
  ): Promise<HookedTask | null> {
    const task = await this.tasks.ofPullRequest(workspaceId, pullRequest);

    return task ? HookedTaskMapper.toHooked(task) : null;
  }
}
