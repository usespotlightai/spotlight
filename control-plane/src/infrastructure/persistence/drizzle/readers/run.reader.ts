import type {
  RunReaderPort,
  TaskRunSummary,
} from '@application/ports/run-reader.port';
import type { TaskId } from '@domain/value-objects/task-id.vo';
import type { UserId } from '@domain/value-objects/user-id.vo';
import type { DrizzleDatabase } from '@infrastructure/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@infrastructure/persistence/drizzle/drizzle.constants';
import { run } from '@infrastructure/persistence/drizzle/schemas/run.schema';
import { workspaceMember } from '@infrastructure/persistence/drizzle/schemas/workspace.schema';
import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';

@Injectable()
export class DrizzleRunReader implements RunReaderPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async listForTask(
    taskId: TaskId,
    viewerId: UserId,
  ): Promise<TaskRunSummary[]> {
    const rows = await this.db
      .select({
        id: run.id,
        state: run.state,
        attempt: run.attempt,
        exitCode: run.exitCode,
        startedAt: run.createdAt,
        updatedAt: run.updatedAt,
      })
      .from(run)
      .innerJoin(
        workspaceMember,
        and(
          eq(workspaceMember.workspaceId, run.workspaceId),
          eq(workspaceMember.userId, viewerId.value),
        ),
      )
      .where(eq(run.taskId, taskId.value))
      .orderBy(desc(run.createdAt));

    return rows;
  }
}
