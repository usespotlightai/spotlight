import type { CompleteWorkingCopyArchiveCommand } from '@runs/application/commands/working-copy-archive.commands';
import type { ArchiveGrants } from '@runs/application/services/archive-grants.service';
import type { RunRepository } from '@runs/domain/repositories/run.repository';
import type { WorkingCopyArchiveRepository } from '@runs/domain/repositories/working-copy-archive.repository';
import { WorkingCopyArchiveId } from '@runs/domain/value-objects/working-copy-archive-id.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';

export class CompleteWorkingCopyArchiveHandler implements CommandHandlerPort<
  CompleteWorkingCopyArchiveCommand,
  boolean
> {
  constructor(
    private readonly runs: RunRepository,
    private readonly archives: WorkingCopyArchiveRepository,
    private readonly grants: ArchiveGrants,
  ) {}

  async execute(command: CompleteWorkingCopyArchiveCommand): Promise<boolean> {
    try {
      const run = await this.runs.findById(RunId.of(command.runId));
      const archive = run?.isLeasedBy(RunnerId.of(command.runnerId))
        ? await this.archives.find(WorkingCopyArchiveId.of(command.archiveId))
        : null;

      if (!run || !archive?.grantedFor(run.id)) {
        return false;
      }

      await this.grants.complete(archive);

      return true;
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
