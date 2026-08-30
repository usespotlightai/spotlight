import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@application/ports/query-handler.port';
import type {
  RunJournal,
  RunJournalReaderPort,
} from '@application/ports/run-journal-reader.port';
import type { ReadTaskJournalQuery } from '@application/queries/read-task-journal.query';
import { TaskId } from '@domain/value-objects/task-id.vo';
import { UserId } from '@domain/value-objects/user-id.vo';

export class ReadTaskJournalHandler
  implements QueryHandlerPort<ReadTaskJournalQuery, RunJournal[] | null>
{
  constructor(private readonly journals: RunJournalReaderPort) {}

  async execute(query: ReadTaskJournalQuery): Promise<RunJournal[] | null> {
    try {
      return await this.journals.listForTask(
        TaskId.of(query.taskId),
        UserId.of(query.viewerId),
      );
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
