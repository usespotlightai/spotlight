import type {
  ChatsPort,
  StartedChat,
} from '@insights/application/ports/chats.port';
import type { DeletionScope } from '@insights/domain/value-objects/deletion-scope.vo';
import { inScope } from '@insights/infrastructure/persistence/drizzle/deletion-scope.sql';
import { chatRecord } from '@insights/infrastructure/persistence/drizzle/schemas/insights.schema';
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

  async removeIn(scope: DeletionScope): Promise<void> {
    await this.context.db.delete(chatRecord).where(inScope(chatRecord, scope));
  }
}
