import type { RunnerAuthenticatorPort } from '@runners/application/ports/runner-authenticator.port';
import type { ForgetSnapshotRemovalCommand } from '@runs/application/commands/snapshot-removal.commands';
import type { ForgottenSnapshotRemovalDto } from '@runs/application/dto/snapshot-removal.dto';
import type { SnapshotRemovalsPort } from '@runs/application/ports/snapshot-removals.port';
import { WorkingCopyArchiveId } from '@runs/domain/value-objects/working-copy-archive-id.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { WorkingCopyStoreName } from '@shared-kernel/domain/value-objects/working-copy-names.vo';

export class ForgetSnapshotRemovalHandler implements CommandHandlerPort<
  ForgetSnapshotRemovalCommand,
  ForgottenSnapshotRemovalDto
> {
  constructor(
    private readonly authenticator: RunnerAuthenticatorPort,
    private readonly removals: SnapshotRemovalsPort,
  ) {}

  async execute(
    command: ForgetSnapshotRemovalCommand,
  ): Promise<ForgottenSnapshotRemovalDto> {
    try {
      const authenticated = await this.authenticator.authenticate(
        command.credential,
      );

      if (!authenticated) {
        return { outcome: 'unauthorized' };
      }

      const store = authenticated.workingCopies?.store ?? null;
      const forgotten =
        store !== null &&
        WorkingCopyArchiveId.isWellFormed(command.archiveId) &&
        (await this.removals.forget(
          authenticated.workspaceId,
          WorkingCopyStoreName.of(store),
          WorkingCopyArchiveId.of(command.archiveId),
        ));

      return { outcome: forgotten ? 'forgotten' : 'unknown' };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
