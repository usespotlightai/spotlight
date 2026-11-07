import type { GrantWorkingCopyArchiveCommand } from '@runs/application/commands/working-copy-archive.commands';
import type { ArchiveGrantDto } from '@runs/application/dto/working-copy-archive.dto';
import type { ArchiveGrants } from '@runs/application/services/archive-grants.service';
import type { RunRepository } from '@runs/domain/repositories/run.repository';
import { ArchiveGrantee } from '@runs/domain/value-objects/archive-grantee.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';

export class GrantWorkingCopyArchiveHandler
  implements
    CommandHandlerPort<GrantWorkingCopyArchiveCommand, ArchiveGrantDto | null>
{
  constructor(
    private readonly runs: RunRepository,
    private readonly grants: ArchiveGrants,
  ) {}

  async execute(
    command: GrantWorkingCopyArchiveCommand,
  ): Promise<ArchiveGrantDto | null> {
    try {
      const run = await this.runs.findById(RunId.of(command.runId));

      if (!run?.isLeasedBy(RunnerId.of(command.runnerId))) {
        return null;
      }

      run.mayActBeyondItself('archive a working copy for a later run');

      return await this.grants.grant({
        workspaceId: run.workspaceId,
        workingCopyKey: run.workingCopyKey,
        grantee: ArchiveGrantee.run(run.id),
        size: command.size,
        sha256: command.sha256,
      });
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
