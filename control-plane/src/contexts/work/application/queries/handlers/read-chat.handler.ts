import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { ChatDto } from '@work/application/dto/chat.dto';
import type { ChatReaderPort } from '@work/application/ports/chat-reader.port';
import type { ReadChatQuery } from '@work/application/queries/chat.queries';
import type { WorkAccess } from '@work/application/services/work-access.service';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';

export class ReadChatHandler
  implements QueryHandlerPort<ReadChatQuery, ChatDto | null>
{
  constructor(
    private readonly chats: ChatReaderPort,
    private readonly access: WorkAccess,
  ) {}

  async execute(query: ReadChatQuery): Promise<ChatDto | null> {
    try {
      const teamId = TeamId.of(query.teamId);
      const chatId = ChatId.of(query.chatId);
      const ownership = await this.chats.ownershipOf(chatId);

      return ownership?.teamId.equals(teamId) &&
        (await this.access.opensChat(ownership, UserId.of(query.viewerId)))
        ? await this.chats.read(teamId, chatId)
        : null;
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
