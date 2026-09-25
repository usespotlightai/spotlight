import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { GrantWorkspaceArchiveCommand } from '@work/application/commands/workspace-archive.commands';
import type { ArchiveGrantDto } from '@work/application/dto/workspace-archive.dto';
import type { HeldRunReaderPort } from '@work/application/ports/held-run-reader.port';
import type { WorkspaceArchiveStorePort } from '@work/application/ports/workspace-archive-store.port';
import { WorkspaceArchive } from '@work/domain/aggregates/workspace-archive.aggregate';
import { InvalidWorkspaceArchiveError } from '@work/domain/exceptions/invalid-workspace-archive.error';
import type { WorkspaceArchiveRepository } from '@work/domain/repositories/workspace-archive.repository';
import { ArchiveDigest } from '@work/domain/value-objects/archive-digest.vo';
import { ArchiveSize } from '@work/domain/value-objects/archive-size.vo';
import { WorkspaceArchiveId } from '@work/domain/value-objects/workspace-archive-id.vo';

export class GrantWorkspaceArchiveHandler
  implements
    CommandHandlerPort<GrantWorkspaceArchiveCommand, ArchiveGrantDto | null>
{
  constructor(
    private readonly held: HeldRunReaderPort,
    private readonly archives: WorkspaceArchiveRepository,
    private readonly store: WorkspaceArchiveStorePort,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(
    command: GrantWorkspaceArchiveCommand,
  ): Promise<ArchiveGrantDto | null> {
    try {
      const run = RunId.of(command.runId);
      const found = await this.held.continuityOf(
        run,
        RunnerId.of(command.runnerId),
      );

      if (!found) {
        return null;
      }

      if (!found.continuity || !found.holder) {
        throw new InvalidWorkspaceArchiveError(
          'is kept only for work that carries on in a later run',
        );
      }

      const archive = WorkspaceArchive.granted({
        id: WorkspaceArchiveId.of(this.ids.generate()),
        workspaceId: found.workspaceId,
        continuity: found.continuity,
        holder: found.holder,
        run,
        size: ArchiveSize.of(command.size),
        digest: ArchiveDigest.of(command.sha256),
        at: this.clock.now(),
      });

      await this.archives.add(archive);

      const upload = await this.store.grantUpload(archive);

      return { id: archive.id.value, url: upload.url, headers: upload.headers };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
