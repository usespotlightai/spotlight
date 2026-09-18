import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { type RevokeRunnerCommand } from '@runners/application/commands/runner-fleet.commands';
import { NotWorkspaceAdministratorError } from '@runners/application/errors/not-workspace-administrator.error';
import { reviseRunner } from '@runners/application/services/runner-revisions';
import { UnknownRunnerError } from '@runners/domain/exceptions/unknown-runner.error';
import type { RunnerRepository } from '@runners/domain/repositories/runner.repository';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class RevokeRunnerHandler
  implements CommandHandlerPort<RevokeRunnerCommand, void>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly runners: RunnerRepository,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: RevokeRunnerCommand): Promise<void> {
    try {
      const membership = await this.access.inWorkspace(
        command.slug,
        UserId.of(command.viewerId),
      );

      if (!membership) {
        throw new UnknownRunnerError(command.runnerId);
      }

      if (!membership.administers) {
        throw new NotWorkspaceAdministratorError();
      }

      const revoked = await reviseRunner(
        this.runners,
        RunnerId.of(command.runnerId),
        (runner) => {
          if (!runner.belongsTo(membership.workspaceId)) {
            throw new UnknownRunnerError(command.runnerId);
          }

          return runner.revoke(this.clock.now());
        },
      );

      if (!revoked) {
        throw new UnknownRunnerError(command.runnerId);
      }
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
