import type { RunJournal } from '@application/contracts/run-journal.contract';
import type { RunJournalReaderPort } from '@application/ports/run-journal-reader.port';
import type { ChatId } from '@domain/value-objects/chat-id.vo';
import type { TaskId } from '@domain/value-objects/task-id.vo';
import type { TeamId } from '@domain/value-objects/team-id.vo';
import type { UserId } from '@domain/value-objects/user-id.vo';
import type { DrizzleDatabase } from '@infrastructure/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@infrastructure/persistence/drizzle/drizzle.constants';
import {
  journalsOfChat,
  journalsOfTask,
} from '@infrastructure/persistence/drizzle/readers/run-journals';
import { chat } from '@infrastructure/persistence/drizzle/schemas/chat.schema';
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

  async listForChat(
    teamId: TeamId,
    chatId: ChatId,
    viewerId: UserId,
  ): Promise<RunJournal[] | null> {
    const [visible] = await this.db
      .select({ id: chat.id })
      .from(chat)
      .where(
        and(
          eq(chat.id, chatId.value),
          eq(chat.teamId, teamId.value),
          eq(chat.startedById, viewerId.value),
        ),
      )
      .limit(1);

    return visible ? journalsOfChat(this.db, chatId) : null;
  }
}
