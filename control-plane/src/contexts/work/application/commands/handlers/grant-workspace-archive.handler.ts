import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { GrantWorkspaceArchiveCommand } from '@work/application/commands/workspace-archive.commands';
import type { ArchiveGrantDto } from '@work/application/dto/workspace-archive.dto';
import type { WorkspaceArchiveStorePort } from '@work/application/ports/workspace-archive-store.port';
import { WorkspaceArchive } from '@work/domain/aggregates/workspace-archive.aggregate';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import type { WorkspaceArchiveRepository } from '@work/domain/repositories/workspace-archive.repository';
import { ArchiveDigest } from '@work/domain/value-objects/archive-digest.vo';
import { ArchiveSize } from '@work/domain/value-objects/archive-size.vo';
import { WorkspaceArchiveId } from '@work/domain/value-objects/workspace-archive-id.vo';

export class GrantWorkspaceArchiveHandler
  implements
    CommandHandlerPort<GrantWorkspaceArchiveCommand, ArchiveGrantDto | null>
{
  constructor(
    private readonly runs: RunRepository,
    private readonly archives: WorkspaceArchiveRepository,
    private readonly store: WorkspaceArchiveStorePort,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(
    command: GrantWorkspaceArchiveCommand,
  ): Promise<ArchiveGrantDto | null> {
    try {
      const run = await this.runs.findById(RunId.of(command.runId));

      if (!run?.isLeasedBy(RunnerId.of(command.runnerId))) {
        return null;
      }

      run.mayReachBeyondItself('keep a workspace for a later run');

      const archive = WorkspaceArchive.grant({
        id: WorkspaceArchiveId.of(this.ids.generate()),
        workspaceId: run.workspaceId,
        continuity: run.continuity,
        holder: run.archiveHolder,
        run: run.id,
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
