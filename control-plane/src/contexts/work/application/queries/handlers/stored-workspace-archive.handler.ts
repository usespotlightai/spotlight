import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { WorkspaceArchiveAnswer } from '@work/application/dto/workspace-archive.dto';
import type { WorkspaceArchiveStorePort } from '@work/application/ports/workspace-archive-store.port';
import type { StoredWorkspaceArchiveQuery } from '@work/application/queries/stored-workspace-archive.query';
import type { Run } from '@work/domain/aggregates/run.aggregate';
import type { WorkspaceArchive } from '@work/domain/aggregates/workspace-archive.aggregate';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import type { WorkspaceArchiveRepository } from '@work/domain/repositories/workspace-archive.repository';

export class StoredWorkspaceArchiveHandler
  implements
    QueryHandlerPort<StoredWorkspaceArchiveQuery, WorkspaceArchiveAnswer>
{
  constructor(
    private readonly runs: RunRepository,
    private readonly archives: WorkspaceArchiveRepository,
    private readonly store: WorkspaceArchiveStorePort,
  ) {}

  async execute(
    query: StoredWorkspaceArchiveQuery,
  ): Promise<WorkspaceArchiveAnswer> {
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

  private async restoredBy(run: Run): Promise<WorkspaceArchive | null> {
    const exactly = run.restoresArchive;

    if (exactly) {
      const archive = await this.archives.find(exactly);

      return archive?.isAvailableIn(run.workspaceId) ? archive : null;
    }

    const restoresFrom = run.restoresFrom;

    return restoresFrom
      ? this.archives.newestCompleted(run.workspaceId, restoresFrom)
      : null;
  }
}
