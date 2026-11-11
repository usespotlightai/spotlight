import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { JournalledRunDto } from '@work/application/dto/run-journal.dto';
import { RunJournalMapper } from '@work/application/mappers/run-journal.mapper';
import type { RunJournalReaderPort } from '@work/application/ports/run-journal-reader.port';
import type { ListTaskJournalRunsQuery } from '@work/application/queries/read-task-journal.query';
import type { RunAccess } from '@work/application/services/run-access.service';

export class ListTaskJournalRunsHandler
  implements
    QueryHandlerPort<ListTaskJournalRunsQuery, JournalledRunDto[] | null>
{
  constructor(
    private readonly journals: RunJournalReaderPort,
    private readonly access: RunAccess,
  ) {}

  async execute(
    query: ListTaskJournalRunsQuery,
  ): Promise<JournalledRunDto[] | null> {
    try {
      const runs = await this.access.shownInWorkspace(
        await this.journals.runsOfTask(TaskId.of(query.taskId)),
        UserId.of(query.viewerId),
      );

      return runs?.map(RunJournalMapper.runToDto) ?? null;
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
