import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { GrantSandboxArchiveCommand } from '@work/application/commands/workspace-archive.commands';
import type { ArchiveGrantDto } from '@work/application/dto/workspace-archive.dto';
import type { WorkspaceArchiveStorePort } from '@work/application/ports/workspace-archive-store.port';
import type { SandboxArchives } from '@work/application/services/sandbox-archives.service';
import { WorkspaceArchive } from '@work/domain/aggregates/workspace-archive.aggregate';
import type { WorkspaceArchiveRepository } from '@work/domain/repositories/workspace-archive.repository';
import { ArchiveDigest } from '@work/domain/value-objects/archive-digest.vo';
import { ArchiveGrantee } from '@work/domain/value-objects/archive-grantee.vo';
import { ArchiveSize } from '@work/domain/value-objects/archive-size.vo';
import { WorkspaceArchiveId } from '@work/domain/value-objects/workspace-archive-id.vo';

export class GrantSandboxArchiveHandler
  implements
    CommandHandlerPort<GrantSandboxArchiveCommand, ArchiveGrantDto | null>
{
  constructor(
    private readonly sandboxes: SandboxArchives,
    private readonly archives: WorkspaceArchiveRepository,
    private readonly store: WorkspaceArchiveStorePort,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(
    command: GrantSandboxArchiveCommand,
  ): Promise<ArchiveGrantDto | null> {
    try {
      const sandbox = await this.sandboxes.authenticated(
        command.sandboxId,
        command.token,
      );

      if (!sandbox) {
        return null;
      }

      const archive = WorkspaceArchive.grant({
        id: WorkspaceArchiveId.of(this.ids.generate()),
        workspaceId: sandbox.workspaceId,
        resumeKey: sandbox.key,
        holder: sandbox.key?.archiveHolder ?? null,
        grantee: ArchiveGrantee.sandbox(sandbox.id),
        size: ArchiveSize.of(command.size),
        digest: ArchiveDigest.of(command.sha256),
        at: this.clock.now(),
      });

      const upload = await this.store.grantUpload(archive);

      await this.archives.add(archive);

      return { id: archive.id.value, url: upload.url, headers: upload.headers };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
