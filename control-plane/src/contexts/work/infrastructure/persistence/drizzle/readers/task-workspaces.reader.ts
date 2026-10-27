import { Inject, Injectable } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { TaskWorkspacesPort } from '@work/application/ports/task-workspaces.port';
import { task } from '@work/infrastructure/persistence/drizzle/schemas/task.schema';
import { eq } from 'drizzle-orm';

@Injectable()
export class DrizzleTaskWorkspaces implements TaskWorkspacesPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async workspaceOf(taskId: TaskId): Promise<WorkspaceId | null> {
    const [found] = await this.db
      .select({ workspaceId: task.workspaceId })
      .from(task)
      .where(eq(task.id, taskId.value))
      .limit(1);

    return found ? WorkspaceId.of(found.workspaceId) : null;
  }
}
