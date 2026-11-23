import type { RunnerAuthenticatorPort } from '@runners/application/ports/runner-authenticator.port';
import type { ForgetSnapshotRemovalCommand } from '@runs/application/commands/snapshot-removal.commands';
import type { ForgottenSnapshotRemovalDto } from '@runs/application/dto/snapshot-removal.dto';
import type { SnapshotRemovalsPort } from '@runs/application/ports/snapshot-removals.port';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';

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

      const store = authenticated.workingCopies?.store;
      const forgotten =
        store !== undefined &&
        (await this.removals.forget(
          authenticated.workspaceId,
          store,
          command.archiveId,
        ));

      return { outcome: forgotten ? 'forgotten' : 'unknown' };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
