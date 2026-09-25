import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { SealWorkspaceArchiveCommand } from '@work/application/commands/workspace-archive.commands';
import type { HeldRunReaderPort } from '@work/application/ports/held-run-reader.port';
import type { WorkspaceArchiveStorePort } from '@work/application/ports/workspace-archive-store.port';
import type { WorkspaceArchiveRepository } from '@work/domain/repositories/workspace-archive.repository';
import { WorkspaceArchiveId } from '@work/domain/value-objects/workspace-archive-id.vo';

export class SealWorkspaceArchiveHandler
  implements CommandHandlerPort<SealWorkspaceArchiveCommand, boolean>
{
  constructor(
    private readonly held: HeldRunReaderPort,
    private readonly archives: WorkspaceArchiveRepository,
    private readonly store: WorkspaceArchiveStorePort,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: SealWorkspaceArchiveCommand): Promise<boolean> {
    try {
      const run = RunId.of(command.runId);
      const found = await this.held.continuityOf(
        run,
        RunnerId.of(command.runnerId),
      );
      const archive = found
        ? await this.archives.find(WorkspaceArchiveId.of(command.archiveId))
        : null;

      if (!archive?.grantedFor(run)) {
        return false;
      }

      if (archive.isSealed) {
        return true;
      }

      const stored = await this.store.stored(archive);

      await this.archives.save(archive.sealed(stored, this.clock.now()));

      return true;
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
