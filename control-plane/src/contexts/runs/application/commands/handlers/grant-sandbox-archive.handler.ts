import type { GrantSandboxArchiveCommand } from '@runs/application/commands/workspace-archive.commands';
import type { ArchiveGrantDto } from '@runs/application/dto/workspace-archive.dto';
import type { WorkspaceArchiveStorePort } from '@runs/application/ports/workspace-archive-store.port';
import type { ArchiveHolders } from '@runs/application/services/archive-holders.service';
import type { SandboxArchives } from '@runs/application/services/sandbox-archives.service';
import { WorkspaceArchive } from '@runs/domain/aggregates/workspace-archive.aggregate';
import type { WorkspaceArchiveRepository } from '@runs/domain/repositories/workspace-archive.repository';
import { ArchiveDigest } from '@runs/domain/value-objects/archive-digest.vo';
import { ArchiveGrantee } from '@runs/domain/value-objects/archive-grantee.vo';
import { ArchiveSize } from '@runs/domain/value-objects/archive-size.vo';
import { WorkspaceArchiveId } from '@runs/domain/value-objects/workspace-archive-id.vo';
import type { WorkspaceKey } from '@runs/domain/value-objects/workspace-key.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';

export class GrantSandboxArchiveHandler
  implements
    CommandHandlerPort<GrantSandboxArchiveCommand, ArchiveGrantDto | null>
{
  constructor(
    private readonly sandboxes: SandboxArchives,
    private readonly archives: WorkspaceArchiveRepository,
    private readonly store: WorkspaceArchiveStorePort,
    private readonly holders: ArchiveHolders,
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
        workspaceKey: sandbox.key,
        held: this.held(sandbox.key),
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

  private held(key: WorkspaceKey | null): boolean {
    return key !== null && this.holders.holds(key.owner);
  }
}
