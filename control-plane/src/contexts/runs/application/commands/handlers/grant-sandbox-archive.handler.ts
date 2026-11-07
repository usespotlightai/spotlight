import type { GrantSandboxArchiveCommand } from '@runs/application/commands/working-copy-archive.commands';
import type { ArchiveGrantDto } from '@runs/application/dto/working-copy-archive.dto';
import type { ArchiveGrants } from '@runs/application/services/archive-grants.service';
import type { SandboxArchives } from '@runs/application/services/sandbox-archives.service';
import { ArchiveGrantee } from '@runs/domain/value-objects/archive-grantee.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';

export class GrantSandboxArchiveHandler
  implements
    CommandHandlerPort<GrantSandboxArchiveCommand, ArchiveGrantDto | null>
{
  constructor(
    private readonly sandboxes: SandboxArchives,
    private readonly grants: ArchiveGrants,
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

      return await this.grants.grant({
        workspaceId: sandbox.workspaceId,
        workingCopyKey: sandbox.key,
        grantee: ArchiveGrantee.sandbox(sandbox.id),
        size: command.size,
        sha256: command.sha256,
      });
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
