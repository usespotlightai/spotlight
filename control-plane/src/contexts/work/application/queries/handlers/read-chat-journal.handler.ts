import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { RunJournalDto } from '@work/application/dto/run-journal.dto';
import { RunJournalMapper } from '@work/application/mappers/run-journal.mapper';
import type { RunJournalReaderPort } from '@work/application/ports/run-journal-reader.port';
import type { ReadChatJournalQuery } from '@work/application/queries/chat.queries';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';

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
      rethrowAsApplicationError(error);
    }
  }
}
