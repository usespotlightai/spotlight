import type { SandboxArchiveAnswer } from '@runs/application/dto/working-copy-archive.dto';
import type { WorkingCopyArchiveStorePort } from '@runs/application/ports/working-copy-archive-store.port';
import type { StoredSandboxArchiveQuery } from '@runs/application/queries/stored-working-copy-archive.query';
import type { SandboxArchives } from '@runs/application/services/sandbox-archives.service';
import type { WorkingCopyArchiveRepository } from '@runs/domain/repositories/working-copy-archive.repository';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class StoredSandboxArchiveHandler
  implements QueryHandlerPort<StoredSandboxArchiveQuery, SandboxArchiveAnswer>
{
  constructor(
    private readonly sandboxes: SandboxArchives,
    private readonly archives: WorkingCopyArchiveRepository,
    private readonly store: WorkingCopyArchiveStorePort,
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
