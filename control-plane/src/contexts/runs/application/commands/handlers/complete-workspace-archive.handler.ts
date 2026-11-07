import type { CompleteWorkspaceArchiveCommand } from '@runs/application/commands/workspace-archive.commands';
import type { ArchiveGrants } from '@runs/application/services/archive-grants.service';
import type { RunRepository } from '@runs/domain/repositories/run.repository';
import type { WorkspaceArchiveRepository } from '@runs/domain/repositories/workspace-archive.repository';
import { WorkspaceArchiveId } from '@runs/domain/value-objects/workspace-archive-id.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';

export class CompleteWorkspaceArchiveHandler
  implements CommandHandlerPort<CompleteWorkspaceArchiveCommand, boolean>
{
  constructor(
    private readonly runs: RunRepository,
    private readonly archives: WorkspaceArchiveRepository,
    private readonly grants: ArchiveGrants,
  ) {}

  async execute(command: CompleteWorkspaceArchiveCommand): Promise<boolean> {
    try {
      const run = await this.runs.findById(RunId.of(command.runId));
      const archive = run?.isLeasedBy(RunnerId.of(command.runnerId))
        ? await this.archives.find(WorkspaceArchiveId.of(command.archiveId))
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
