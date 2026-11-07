import type { CompleteSandboxArchiveCommand } from '@runs/application/commands/workspace-archive.commands';
import type { ArchiveGrants } from '@runs/application/services/archive-grants.service';
import type { SandboxArchives } from '@runs/application/services/sandbox-archives.service';
import type { WorkspaceArchiveRepository } from '@runs/domain/repositories/workspace-archive.repository';
import { WorkspaceArchiveId } from '@runs/domain/value-objects/workspace-archive-id.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';

export class CompleteSandboxArchiveHandler
  implements CommandHandlerPort<CompleteSandboxArchiveCommand, boolean>
{
  constructor(
    private readonly sandboxes: SandboxArchives,
    private readonly archives: WorkspaceArchiveRepository,
    private readonly grants: ArchiveGrants,
  ) {}

  async execute(command: CompleteSandboxArchiveCommand): Promise<boolean> {
    try {
      const sandbox = await this.sandboxes.authenticated(
        command.sandboxId,
        command.token,
      );
      const archive = sandbox
        ? await this.archives.find(WorkspaceArchiveId.of(command.archiveId))
        : null;

      if (!sandbox || !archive?.grantedForSandbox(sandbox.id)) {
        return false;
      }

      await this.grants.complete(archive);

      return true;
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
