import type { RunJournalDto } from '@application/dto/run-journal.dto';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import { RunJournalMapper } from '@application/mappers/run-journal.mapper';
import type { QueryHandlerPort } from '@application/ports/query-handler.port';
import type { RunJournalReaderPort } from '@application/ports/run-journal-reader.port';
import type { ReadChatJournalQuery } from '@application/queries/chat.queries';
import { ChatId } from '@domain/value-objects/chat-id.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { UserId } from '@domain/value-objects/user-id.vo';

export class ReadChatJournalHandler
  implements QueryHandlerPort<ReadChatJournalQuery, RunJournalDto[] | null>
{
  constructor(private readonly journals: RunJournalReaderPort) {}

  async execute(query: ReadChatJournalQuery): Promise<RunJournalDto[] | null> {
    try {
      const worked = await this.journals.listForChat(
        TeamId.of(query.teamId),
        ChatId.of(query.chatId),
        UserId.of(query.viewerId),
      );

      return worked?.map(RunJournalMapper.toDto) ?? null;
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
