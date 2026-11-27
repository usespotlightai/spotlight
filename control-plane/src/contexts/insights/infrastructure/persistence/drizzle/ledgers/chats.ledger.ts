import type {
  ChatRunSpend,
  ChatsPort,
  StartedChat,
} from '@insights/application/ports/chats.port';
import type { DeletionScope } from '@insights/domain/value-objects/deletion-scope.vo';
import { inScope } from '@insights/infrastructure/persistence/drizzle/deletion-scope.sql';
import {
  chatRecord,
  chatRunSpend,
} from '@insights/infrastructure/persistence/drizzle/schemas/insights.schema';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';

@Injectable()
export class DrizzleChats implements ChatsPort {
  constructor(private readonly context: DrizzleContext) {}

  async note(chat: StartedChat): Promise<void> {
    await this.context.db
      .insert(chatRecord)
      .values({
        chatId: chat.chatId,
        workspaceId: chat.workspaceId.value,
        teamId: chat.teamId.value,
        startedById: chat.startedBy.value,
        startedAt: chat.startedAt,
      })
      .onConflictDoNothing({ target: chatRecord.chatId });
  }

  async spent(run: ChatRunSpend): Promise<void> {
    await this.context.db
      .insert(chatRunSpend)
      .values({
        runId: run.runId.value,
        chatId: run.chatId,
        workspaceId: run.workspaceId.value,
        teamId: run.teamId.value,
        harness: run.harness,
        model: run.model,
        repositories: [...run.repositories],
        cost: run.spend?.amount ?? null,
        currency: run.spend?.currency ?? null,
        spentAt: run.spentAt,
      })
      .onConflictDoNothing({ target: chatRunSpend.runId });
  }

  async removeIn(scope: DeletionScope): Promise<void> {
    await this.context.db.delete(chatRecord).where(inScope(chatRecord, scope));
    await this.context.db
      .delete(chatRunSpend)
      .where(inScope(chatRunSpend, scope));
  }
}
