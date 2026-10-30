import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { CompleteSandboxArchiveCommand } from '@work/application/commands/workspace-archive.commands';
import type { WorkspaceArchiveStorePort } from '@work/application/ports/workspace-archive-store.port';
import type { SandboxArchives } from '@work/application/services/sandbox-archives.service';
import type { WorkspaceArchiveRepository } from '@work/domain/repositories/workspace-archive.repository';
import { WorkspaceArchiveId } from '@work/domain/value-objects/workspace-archive-id.vo';

export class CompleteSandboxArchiveHandler
  implements CommandHandlerPort<CompleteSandboxArchiveCommand, boolean>
{
  constructor(
    private readonly sandboxes: SandboxArchives,
    private readonly archives: WorkspaceArchiveRepository,
    private readonly store: WorkspaceArchiveStorePort,
    private readonly clock: ClockPort,
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

      if (archive.isCompleted) {
        return true;
      }

      const stored = await this.store.stored(archive);

      await this.archives.save(archive.complete(stored, this.clock.now()));

      return true;
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
