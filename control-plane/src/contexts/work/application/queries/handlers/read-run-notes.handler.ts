import type { RunUsageReaderPort } from '@runs/application/ports/run-usage-reader.port';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { RunNotesDto } from '@work/application/dto/run-notes.dto';
import { RunSpendMapper } from '@work/application/mappers/run-spend.mapper';
import type { RunReaderPort } from '@work/application/ports/run-reader.port';
import type { ReadRunNotesQuery } from '@work/application/queries/read-run-notes.query';
import type { RunAccess } from '@work/application/services/run-access.service';

export class ReadRunNotesHandler
  implements QueryHandlerPort<ReadRunNotesQuery, RunNotesDto | null>
{
  constructor(
    private readonly runs: RunReaderPort,
    private readonly usages: RunUsageReaderPort,
    private readonly access: RunAccess,
  ) {}

  async execute(query: ReadRunNotesQuery): Promise<RunNotesDto | null> {
    try {
      const runId = RunId.of(query.runId);
      const found = await this.access.shownInWorkspace(
        await this.runs.notesFor(runId),
        UserId.of(query.viewerId),
      );

      if (!found) {
        return null;
      }

      const usage = (await this.usages.forRuns([runId])).get(runId.value);

      return {
        ...found,
        createdAt: found.createdAt.toISOString(),
        notes: found.notes.map((note) => ({
          ...note,
          at: note.at.toISOString(),
        })),
        spend: usage ? RunSpendMapper.toDto(usage) : null,
      };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
