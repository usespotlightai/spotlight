import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { WorkspaceArchiveAnswer } from '@work/application/dto/workspace-archive.dto';
import type { HeldRunReaderPort } from '@work/application/ports/held-run-reader.port';
import type { WorkspaceArchiveStorePort } from '@work/application/ports/workspace-archive-store.port';
import type { HeldWorkspaceArchiveQuery } from '@work/application/queries/held-workspace-archive.query';
import type { WorkspaceArchiveRepository } from '@work/domain/repositories/workspace-archive.repository';

export class HeldWorkspaceArchiveHandler
  implements QueryHandlerPort<HeldWorkspaceArchiveQuery, WorkspaceArchiveAnswer>
{
  constructor(
    private readonly held: HeldRunReaderPort,
    private readonly archives: WorkspaceArchiveRepository,
    private readonly store: WorkspaceArchiveStorePort,
  ) {}

  async execute(
    query: HeldWorkspaceArchiveQuery,
  ): Promise<WorkspaceArchiveAnswer> {
    try {
      const found = await this.held.continuityOf(
        RunId.of(query.runId),
        RunnerId.of(query.runnerId),
      );

      if (!found) {
        return { held: false };
      }

      const archive =
        found.continuing && found.continuity
          ? await this.archives.newestSealed(
              found.workspaceId,
              found.continuity,
            )
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
