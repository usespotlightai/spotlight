import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { TaskAside } from '@work/domain/aggregates/task-aside.aggregate';
import { UnknownTaskAsideError } from '@work/domain/exceptions/unknown-task-aside.error';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import type { TaskAsideRepository } from '@work/domain/repositories/task-aside.repository';
import { TaskAsideId } from '@work/domain/value-objects/task-aside-id.vo';

export class AsideAtHand {
  constructor(
    private readonly asides: TaskAsideRepository,
    private readonly tasks: TaskRepository,
    private readonly lines: LineRepository,
    private readonly access: WorkspaceAccessPort,
  ) {}

  async putTo(asideId: string, them: string): Promise<TaskAside> {
    const viewer = UserId.of(them);
    const aside = await this.asides.find(TaskAsideId.of(asideId));
    const task = aside ? await this.tasks.find(aside.taskId) : null;
    const line = task ? await this.lines.holding(task.stationId) : null;

    if (
      !aside ||
      !task ||
      !line ||
      !TaskAside.attendedBy({
        viewer,
        assignee: task.assignee,
        onTeam: (await this.access.onTeam(line.teamId.value, viewer)) !== null,
      })
    ) {
      throw new UnknownTaskAsideError(asideId);
    }

    return aside;
  }
}
