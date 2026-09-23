import {
  WORKSPACE_ACCESS,
  type WorkspaceAccessPort,
} from '@identity/application/ports/workspace-access.port';
import { Inject, Injectable } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { RunJournal } from '@work/application/contracts/run-journal.contract';
import type { RunJournalReaderPort } from '@work/application/ports/run-journal-reader.port';
import type { ChatId } from '@work/domain/value-objects/chat-id.vo';
import {
  journalOfRun,
  journalsOfChat,
  journalsOfTask,
} from '@work/infrastructure/persistence/drizzle/readers/run-journals';
import { chat } from '@work/infrastructure/persistence/drizzle/schemas/chat.schema';
import { task } from '@work/infrastructure/persistence/drizzle/schemas/task.schema';
import { and, eq } from 'drizzle-orm';

@Injectable()
export class DrizzleRunJournalReader implements RunJournalReaderPort {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDatabase,
    @Inject(WORKSPACE_ACCESS) private readonly access: WorkspaceAccessPort,
  ) {}

  async listForTask(
    taskId: TaskId,
    viewerId: UserId,
  ): Promise<RunJournal[] | null> {
    const [visible] = await this.db
      .select({ workspaceId: task.workspaceId })
      .from(task)
      .where(eq(task.id, taskId.value))
      .limit(1);

    if (
      !visible ||
      !(await this.access.mayView(
        viewerId,
        WorkspaceId.of(visible.workspaceId),
      ))
    ) {
      return null;
    }

    return journalsOfTask(this.db, taskId);
  }

  ofRun(runId: RunId): Promise<RunJournal | null> {
    return journalOfRun(this.db, runId);
  }

  ofTask(taskId: TaskId): Promise<RunJournal[]> {
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
