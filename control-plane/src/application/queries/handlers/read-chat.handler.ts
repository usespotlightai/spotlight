import type { ChatDto } from '@application/dto/chat.dto';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { ChatReaderPort } from '@application/ports/chat-reader.port';
import type { QueryHandlerPort } from '@application/ports/query-handler.port';
import type { ReadChatQuery } from '@application/queries/chat.queries';
import { ChatId } from '@domain/value-objects/chat-id.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { UserId } from '@domain/value-objects/user-id.vo';

export class ReadChatHandler
  implements QueryHandlerPort<ReadChatQuery, ChatDto | null>
{
  constructor(private readonly chats: ChatReaderPort) {}

  async execute(query: ReadChatQuery): Promise<ChatDto | null> {
    try {
      return await this.chats.read(
        TeamId.of(query.teamId),
        ChatId.of(query.chatId),
        UserId.of(query.viewerId),
      );
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
