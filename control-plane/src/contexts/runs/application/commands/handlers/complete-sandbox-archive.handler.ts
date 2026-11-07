import type { CompleteSandboxArchiveCommand } from '@runs/application/commands/working-copy-archive.commands';
import type { ArchiveGrants } from '@runs/application/services/archive-grants.service';
import type { SandboxArchives } from '@runs/application/services/sandbox-archives.service';
import type { WorkingCopyArchiveRepository } from '@runs/domain/repositories/working-copy-archive.repository';
import { WorkingCopyArchiveId } from '@runs/domain/value-objects/working-copy-archive-id.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';

export class CompleteSandboxArchiveHandler
  implements CommandHandlerPort<CompleteSandboxArchiveCommand, boolean>
{
  constructor(
    private readonly sandboxes: SandboxArchives,
    private readonly archives: WorkingCopyArchiveRepository,
    private readonly grants: ArchiveGrants,
  ) {}

  async execute(command: CompleteSandboxArchiveCommand): Promise<boolean> {
    try {
      const sandbox = await this.sandboxes.authenticated(
        command.sandboxId,
        command.token,
      );
      const archive = sandbox
        ? await this.archives.find(WorkingCopyArchiveId.of(command.archiveId))
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
