import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { ChatDto } from '@work/application/dto/chat.dto';
import type { ChatReaderPort } from '@work/application/ports/chat-reader.port';
import type { ReadChatQuery } from '@work/application/queries/chat.queries';
import type { ChatLoader } from '@work/application/services/chat-loader.service';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';

export class ReadChatHandler
  implements QueryHandlerPort<ReadChatQuery, ChatDto | null>
{
  constructor(
    private readonly chats: ChatReaderPort,
    private readonly loader: ChatLoader,
  ) {}

  async execute(query: ReadChatQuery): Promise<ChatDto | null> {
    try {
      const chat = await this.loader.openableBy(
        query.teamId,
        query.chatId,
        query.viewerId,
      );

      return chat
        ? await this.chats.read(
            TeamId.of(query.teamId),
            ChatId.of(query.chatId),
          )
        : null;
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
