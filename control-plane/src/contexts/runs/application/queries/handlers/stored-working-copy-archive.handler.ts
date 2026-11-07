import type { WorkingCopyArchiveAnswer } from '@runs/application/dto/working-copy-archive.dto';
import type { WorkingCopyArchiveStorePort } from '@runs/application/ports/working-copy-archive-store.port';
import type { StoredWorkingCopyArchiveQuery } from '@runs/application/queries/stored-working-copy-archive.query';
import type { Run } from '@runs/domain/aggregates/run.aggregate';
import type { WorkingCopyArchive } from '@runs/domain/aggregates/working-copy-archive.aggregate';
import type { RunRepository } from '@runs/domain/repositories/run.repository';
import type { WorkingCopyArchiveRepository } from '@runs/domain/repositories/working-copy-archive.repository';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';

export class StoredWorkingCopyArchiveHandler
  implements
    QueryHandlerPort<StoredWorkingCopyArchiveQuery, WorkingCopyArchiveAnswer>
{
  constructor(
    private readonly runs: RunRepository,
    private readonly archives: WorkingCopyArchiveRepository,
    private readonly store: WorkingCopyArchiveStorePort,
  ) {}

  async execute(
    query: StoredWorkingCopyArchiveQuery,
  ): Promise<WorkingCopyArchiveAnswer> {
    try {
      const run = await this.runs.findById(RunId.of(query.runId));

      if (!run?.isLeasedBy(RunnerId.of(query.runnerId))) {
        return { leased: false };
      }

      const archive = await this.restoredBy(run);

      if (!archive) {
        return { leased: true, archive: null };
      }

      return {
        leased: true,
        archive: {
          id: archive.id.value,
          url: await this.store.grantDownload(archive),
          size: archive.size.bytes,
          sha256: archive.digest.sha256,
        },
      };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }

  private async restoredBy(run: Run): Promise<WorkingCopyArchive | null> {
    const source = run.restoresFrom;

    if (!source) {
      return null;
    }

    const candidate =
      'archive' in source
        ? await this.archives.find(source.archive)
        : await this.archives.newestCompleted(run.workspaceId, source.newestOf);

    return run.archiveToRestore(candidate ? [candidate] : []);
  }
}
