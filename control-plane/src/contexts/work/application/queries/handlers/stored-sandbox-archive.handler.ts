import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import type { SandboxArchiveAnswer } from '@work/application/dto/workspace-archive.dto';
import type { WorkspaceArchiveStorePort } from '@work/application/ports/workspace-archive-store.port';
import type { StoredSandboxArchiveQuery } from '@work/application/queries/stored-workspace-archive.query';
import type { SandboxArchives } from '@work/application/services/sandbox-archives.service';
import type { WorkspaceArchiveRepository } from '@work/domain/repositories/workspace-archive.repository';

export class StoredSandboxArchiveHandler
  implements QueryHandlerPort<StoredSandboxArchiveQuery, SandboxArchiveAnswer>
{
  constructor(
    private readonly sandboxes: SandboxArchives,
    private readonly archives: WorkspaceArchiveRepository,
    private readonly store: WorkspaceArchiveStorePort,
  ) {}

  async execute(
    query: StoredSandboxArchiveQuery,
  ): Promise<SandboxArchiveAnswer> {
    try {
      const sandbox = await this.sandboxes.authenticated(
        query.sandboxId,
        query.token,
      );

      if (!sandbox) {
        return { known: false };
      }

      const archive = sandbox.key
        ? await this.archives.newestCompleted(sandbox.workspaceId, sandbox.key)
        : null;

      if (!archive) {
        return { known: true, archive: null };
      }

      return {
        known: true,
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
}
