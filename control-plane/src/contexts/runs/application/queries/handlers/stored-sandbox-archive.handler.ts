import type { SandboxArchiveAnswer } from '@runs/application/dto/working-copy-archive.dto';
import type { StoredSandboxArchiveQuery } from '@runs/application/queries/stored-working-copy-archive.query';
import type { RestoredArchives } from '@runs/application/services/restored-archives.service';
import type { SandboxArchives } from '@runs/application/services/sandbox-archives.service';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class StoredSandboxArchiveHandler implements QueryHandlerPort<
  StoredSandboxArchiveQuery,
  SandboxArchiveAnswer
> {
  constructor(
    private readonly sandboxes: SandboxArchives,
    private readonly restored: RestoredArchives,
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

      const archive = await this.restored.newestOf(
        sandbox.workspaceId,
        sandbox.key,
      );

      if (!archive) {
        return { known: true, archive: null };
      }

      return {
        known: true,
        archive: await this.restored.answer(archive, false),
      };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
