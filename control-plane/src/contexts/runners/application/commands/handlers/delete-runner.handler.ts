import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { DeleteRunnerCommand } from '@runners/application/commands/runner-resource.commands';
import { reviseRunner } from '@runners/application/services/runner-revisions';
import { RunnerRevisedError } from '@runners/domain/exceptions/runner-revised.error';
import type { RunnerRepository } from '@runners/domain/repositories/runner.repository';
import {
  forbiddenTo,
  type ResourceDeleted,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';

export class DeleteRunnerHandler
  implements CommandHandlerPort<DeleteRunnerCommand, ResourceDeleted | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly runners: RunnerRepository,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: DeleteRunnerCommand): Promise<ResourceDeleted | null> {
    const id = RunnerId.of(command.runnerId);

    try {
      const standing = await this.runners.find(id);
      const cleared =
        standing && !standing.revoked
          ? await this.access.clearanceIn(
              standing.workspaceId,
              command.actor.principal,
            )
          : null;

      if (!standing || !cleared) {
        return null;
      }

      if (!cleared.managesRunners) {
        return forbiddenTo('manage-runners');
      }

      const by = Attribution.of(command.actor, cleared.workspaceId);

      await reviseRunner(this.runners, id, (runner) => {
        runner.expecting(command.expectedVersion);

        return runner.revoke(this.clock.now(), by);
      });

      return { outcome: 'deleted' };
    } catch (error) {
      if (error instanceof RunnerRevisedError) {
        const current = await this.runners.find(id);

        return current && !current.revoked
          ? { outcome: 'moved-on', currentVersion: current.revision }
          : null;
      }

      rethrowAsFault(error);
    }
  }
}
