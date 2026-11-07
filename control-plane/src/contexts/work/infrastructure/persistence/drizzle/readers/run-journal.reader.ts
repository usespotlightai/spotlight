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
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type {
  JournalledRun,
  RunChanges,
  RunJournal,
} from '@work/application/contracts/run-journal.contract';
import type { RunJournalReaderPort } from '@work/application/ports/run-journal-reader.port';
import { ChatAccess } from '@work/domain/services/chat-access';
import type { ChatId } from '@work/domain/value-objects/chat-id.vo';
import {
  changesOfTask,
  journalOfRun,
  journalsOfChatRun,
  journalsOfRuns,
  journalsOfTask,
  journalsOfTaskRun,
  runsOfChat,
  runsOfTask,
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
    return (await this.mayViewTask(taskId, viewerId))
      ? journalsOfTask(this.db, taskId)
      : null;
  }

  async runsOfTask(
    taskId: TaskId,
    viewerId: UserId,
  ): Promise<JournalledRun[] | null> {
    return (await this.mayViewTask(taskId, viewerId))
      ? runsOfTask(this.db, taskId)
      : null;
  }

  async ofTaskRun(
    taskId: TaskId,
    runId: RunId,
    viewerId: UserId,
  ): Promise<RunJournal[] | null> {
    return (await this.mayViewTask(taskId, viewerId))
      ? journalsOfTaskRun(this.db, taskId, runId)
      : null;
  }

  ofRun(runId: RunId): Promise<RunJournal | null> {
    return journalOfRun(this.db, runId);
  }

  attemptsOfRun(runId: RunId): Promise<RunJournal[]> {
    return journalsOfRuns(this.db, [runId.value]);
  }

  changesOfTask(taskId: TaskId): Promise<RunChanges[]> {
    return changesOfTask(this.db, taskId);
  }

  async runsOfChat(
    teamId: TeamId,
    chatId: ChatId,
    viewerId: UserId,
  ): Promise<JournalledRun[] | null> {
    return (await this.mayViewChat(teamId, chatId, viewerId))
      ? runsOfChat(this.db, chatId)
      : null;
  }

  async ofChatRun(
    teamId: TeamId,
    chatId: ChatId,
    runId: RunId,
    viewerId: UserId,
  ): Promise<RunJournal[] | null> {
    return (await this.mayViewChat(teamId, chatId, viewerId))
      ? journalsOfChatRun(this.db, chatId, runId)
      : null;
  }

  private async mayViewTask(
    taskId: TaskId,
    viewerId: UserId,
  ): Promise<boolean> {
    const [visible] = await this.db
      .select({ workspaceId: task.workspaceId })
      .from(task)
      .where(eq(task.id, taskId.value))
      .limit(1);

    return visible
      ? this.access.mayView(viewerId, WorkspaceId.of(visible.workspaceId))
      : false;
  }

  private async mayViewChat(
    teamId: TeamId,
    chatId: ChatId,
    viewerId: UserId,
  ): Promise<boolean> {
    const [visible] = await this.db
      .select({ startedById: chat.startedById })
      .from(chat)
      .where(and(eq(chat.id, chatId.value), eq(chat.teamId, teamId.value)))
      .limit(1);

    return visible
      ? ChatAccess.readableBy(UserId.of(visible.startedById), viewerId)
      : false;
  }
}
