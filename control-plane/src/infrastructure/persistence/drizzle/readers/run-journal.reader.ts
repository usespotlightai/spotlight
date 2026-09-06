import type { RunJournal } from '@application/contracts/run-journal.contract';
import type { RunJournalReaderPort } from '@application/ports/run-journal-reader.port';
import type { TaskId } from '@domain/value-objects/task-id.vo';
import type { UserId } from '@domain/value-objects/user-id.vo';
import type { DrizzleDatabase } from '@infrastructure/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@infrastructure/persistence/drizzle/drizzle.constants';
import { journalsOfTask } from '@infrastructure/persistence/drizzle/readers/run-journals';
import { task } from '@infrastructure/persistence/drizzle/schemas/task.schema';
import { workspaceMember } from '@infrastructure/persistence/drizzle/schemas/workspace.schema';
import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';

@Injectable()
export class DrizzleRunJournalReader implements RunJournalReaderPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async listForTask(
    taskId: TaskId,
    viewerId: UserId,
  ): Promise<RunJournal[] | null> {
    const [visible] = await this.db
      .select({ id: task.id })
      .from(task)
      .innerJoin(
        workspaceMember,
        and(
          eq(workspaceMember.workspaceId, task.workspaceId),
          eq(workspaceMember.userId, viewerId.value),
        ),
      )
      .where(eq(task.id, taskId.value))
      .limit(1);

    if (!visible) {
      return null;
    }

    return journalsOfTask(this.db, taskId);
  }
}
