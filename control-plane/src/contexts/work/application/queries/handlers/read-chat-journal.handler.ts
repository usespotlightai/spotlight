import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { RunJournalDto } from '@work/application/dto/run-journal.dto';
import { RunJournalMapper } from '@work/application/mappers/run-journal.mapper';
import type { RunJournalReaderPort } from '@work/application/ports/run-journal-reader.port';
import type { ReadChatJournalQuery } from '@work/application/queries/chat.queries';
import type { RunAccess } from '@work/application/services/run-access.service';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';

export class ReadChatJournalHandler
  implements QueryHandlerPort<ReadChatJournalQuery, RunJournalDto[] | null>
{
  constructor(
    private readonly journals: RunJournalReaderPort,
    private readonly access: RunAccess,
  ) {}

  async execute(query: ReadChatJournalQuery): Promise<RunJournalDto[] | null> {
    try {
      const entries = this.access.shownOfChat(
        await this.journals.ofChatRun(
          TeamId.of(query.teamId),
          ChatId.of(query.chatId),
          RunId.of(query.runId),
        ),
        UserId.of(query.viewerId),
      );

      return entries?.map(RunJournalMapper.toDto) ?? null;
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
