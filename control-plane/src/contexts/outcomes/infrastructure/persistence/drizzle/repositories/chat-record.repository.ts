import { Injectable } from '@nestjs/common';
import { ChatRecord } from '@outcomes/domain/aggregates/chat-record.aggregate';
import { ChatRecordMovedOnError } from '@outcomes/domain/exceptions/chat-record-moved-on.error';
import type { ChatRecordRepository } from '@outcomes/domain/repositories/chat-record.repository';
import type { TeamWindow } from '@outcomes/domain/repositories/run-record.repository';
import { chatRecord } from '@outcomes/infrastructure/persistence/drizzle/schemas/outcomes.schema';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, desc, eq, gte, lt } from 'drizzle-orm';

type ChatRow = typeof chatRecord.$inferSelect;

const toRecord = (row: ChatRow): ChatRecord =>
  ChatRecord.rehydrate({
    chatId: row.chatId,
    workspaceId: WorkspaceId.of(row.workspaceId),
    teamId: TeamId.of(row.teamId),
    startedBy: UserId.of(row.startedBy),
    startedAt: row.startedAt,
    version: row.version,
  });

@Injectable()
export class DrizzleChatRecordRepository implements ChatRecordRepository {
  constructor(private readonly context: DrizzleContext) {}

  async add(added: ChatRecord): Promise<void> {
    const written = await this.context.db
      .insert(chatRecord)
      .values({
        chatId: added.chatId,
        workspaceId: added.workspaceId.value,
        teamId: added.teamId.value,
        startedBy: added.startedBy.value,
        startedAt: added.startedAt,
        version: added.version,
      })
      .onConflictDoNothing({ target: chatRecord.chatId })
      .returning({ chatId: chatRecord.chatId });

    if (written.length === 0) {
      throw new ChatRecordMovedOnError(added.chatId);
    }
  }

  async of(chatId: string): Promise<ChatRecord | null> {
    const [row] = await this.context.db
      .select()
      .from(chatRecord)
      .where(eq(chatRecord.chatId, chatId))
      .limit(1);

    return row ? toRecord(row) : null;
  }

  async ofTeamBetween(
    window: TeamWindow,
    most: number,
  ): Promise<readonly ChatRecord[]> {
    const rows = await this.context.db
      .select()
      .from(chatRecord)
      .where(
        and(
          eq(chatRecord.workspaceId, window.workspaceId.value),
          eq(chatRecord.teamId, window.teamId.value),
          gte(chatRecord.startedAt, window.from),
          lt(chatRecord.startedAt, window.to),
        ),
      )
      .orderBy(desc(chatRecord.startedAt), desc(chatRecord.chatId))
      .limit(most);

    return rows.map(toRecord);
  }

  async removeForTeam(workspaceId: WorkspaceId, teamId: TeamId): Promise<void> {
    await this.context.db
      .delete(chatRecord)
      .where(
        and(
          eq(chatRecord.workspaceId, workspaceId.value),
          eq(chatRecord.teamId, teamId.value),
        ),
      );
  }

  async removeForWorkspace(workspaceId: WorkspaceId): Promise<void> {
    await this.context.db
      .delete(chatRecord)
      .where(eq(chatRecord.workspaceId, workspaceId.value));
  }
}
