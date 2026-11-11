import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { JournalledRunDto } from '@work/application/dto/run-journal.dto';
import { RunJournalMapper } from '@work/application/mappers/run-journal.mapper';
import type { RunJournalReaderPort } from '@work/application/ports/run-journal-reader.port';
import type { ListChatJournalRunsQuery } from '@work/application/queries/chat.queries';
import type { RunAccess } from '@work/application/services/run-access.service';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';

export class ListChatJournalRunsHandler
  implements
    QueryHandlerPort<ListChatJournalRunsQuery, JournalledRunDto[] | null>
{
  constructor(
    private readonly journals: RunJournalReaderPort,
    private readonly access: RunAccess,
  ) {}

  async execute(
    query: ListChatJournalRunsQuery,
  ): Promise<JournalledRunDto[] | null> {
    try {
      const runs = await this.access.shownOfChat(
        await this.journals.runsOfChat(
          TeamId.of(query.teamId),
          ChatId.of(query.chatId),
        ),
        UserId.of(query.viewerId),
      );

      return runs?.map(RunJournalMapper.runToDto) ?? null;
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
