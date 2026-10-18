import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { RunJournalDto } from '@work/application/dto/run-journal.dto';
import { RunJournalMapper } from '@work/application/mappers/run-journal.mapper';
import type { RunJournalReaderPort } from '@work/application/ports/run-journal-reader.port';
import type { ReadTaskJournalQuery } from '@work/application/queries/read-task-journal.query';

export class ReadTaskJournalHandler
  implements QueryHandlerPort<ReadTaskJournalQuery, RunJournalDto[] | null>
{
  constructor(private readonly journals: RunJournalReaderPort) {}

  async execute(query: ReadTaskJournalQuery): Promise<RunJournalDto[] | null> {
    try {
      const entries = await this.journals.listForTask(
        TaskId.of(query.taskId),
        UserId.of(query.viewerId),
      );

      return entries?.map(RunJournalMapper.toDto) ?? null;
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
