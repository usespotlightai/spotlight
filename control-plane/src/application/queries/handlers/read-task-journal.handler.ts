import type { RunJournalDto } from '@application/dto/run-journal.dto';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import { RunJournalMapper } from '@application/mappers/run-journal.mapper';
import type { QueryHandlerPort } from '@application/ports/query-handler.port';
import type { RunJournalReaderPort } from '@application/ports/run-journal-reader.port';
import type { ReadTaskJournalQuery } from '@application/queries/read-task-journal.query';
import { TaskId } from '@domain/value-objects/task-id.vo';
import { UserId } from '@domain/value-objects/user-id.vo';

export class ReadTaskJournalHandler
  implements QueryHandlerPort<ReadTaskJournalQuery, RunJournalDto[] | null>
{
  constructor(private readonly journals: RunJournalReaderPort) {}

  async execute(query: ReadTaskJournalQuery): Promise<RunJournalDto[] | null> {
    try {
      const worked = await this.journals.listForTask(
        TaskId.of(query.taskId),
        UserId.of(query.viewerId),
      );

      return worked?.map(RunJournalMapper.toDto) ?? null;
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
