import type { SandboxRetirementPort } from '@runners/application/ports/sandbox-retirement.port';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { WorkRequesters } from '@work/application/services/work-requesters';
import type { TaskDeleted } from '@work/domain/events/task-deleted.event';
import type { TaskFinished } from '@work/domain/events/task-finished.event';
import type { TaskRepository } from '@work/domain/repositories/task.repository';

export class RetireTaskSandbox {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly sandboxes: SandboxRetirementPort,
  ) {}

  async onFinished(event: TaskFinished): Promise<void> {
    const task = await this.tasks.find(event.taskId);

    if (!task || task.finished) {
      await this.retire(event.workspaceId, event.taskId);
    }
  }

  async onDeleted(event: TaskDeleted): Promise<void> {
    await this.retire(event.workspaceId, event.taskId);
  }

  private retire(workspaceId: WorkspaceId, taskId: TaskId): Promise<void> {
    return this.sandboxes.retire(
      workspaceId.value,
      WorkRequesters.taskWorkingCopyKey(taskId),
    );
  }
}
