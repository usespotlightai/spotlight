import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { WorkspaceArchiveAnswer } from '@work/application/dto/workspace-archive.dto';
import type { WorkspaceArchiveStorePort } from '@work/application/ports/workspace-archive-store.port';
import type { HeldWorkspaceArchiveQuery } from '@work/application/queries/held-workspace-archive.query';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import type { WorkspaceArchiveRepository } from '@work/domain/repositories/workspace-archive.repository';

export class HeldWorkspaceArchiveHandler
  implements QueryHandlerPort<HeldWorkspaceArchiveQuery, WorkspaceArchiveAnswer>
{
  constructor(
    private readonly runs: RunRepository,
    private readonly archives: WorkspaceArchiveRepository,
    private readonly store: WorkspaceArchiveStorePort,
  ) {}

  async execute(
    query: HeldWorkspaceArchiveQuery,
  ): Promise<WorkspaceArchiveAnswer> {
    try {
      const run = await this.runs.findById(RunId.of(query.runId));

      if (!run?.isHeldBy(RunnerId.of(query.runnerId))) {
        return { held: false };
      }

      const restoresFrom = run.restoresFrom;
      const archive = restoresFrom
        ? await this.archives.newestSealed(run.workspaceId, restoresFrom)
        : null;

      if (!archive) {
        return { held: true, archive: null };
      }

      return {
        held: true,
        archive: {
          id: archive.id.value,
          url: await this.store.grantDownload(archive),
          size: archive.size.bytes,
          sha256: archive.digest.sha256,
        },
      };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
