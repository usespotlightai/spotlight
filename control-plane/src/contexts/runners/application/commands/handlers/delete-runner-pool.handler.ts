import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { DeleteRunnerPoolCommand } from '@runners/application/commands/runner-resource.commands';
import { RunnerPoolVersionConflictError } from '@runners/domain/exceptions/runner-pool-version-conflict.error';
import type { RunnerPoolRepository } from '@runners/domain/repositories/runner-pool.repository';
import { RunnerPoolId } from '@runners/domain/value-objects/runner-pool-id.vo';
import {
  forbiddenTo,
  type ResourceDeleted,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';

export class DeleteRunnerPoolHandler
  implements CommandHandlerPort<DeleteRunnerPoolCommand, ResourceDeleted | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly pools: RunnerPoolRepository,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(
    command: DeleteRunnerPoolCommand,
  ): Promise<ResourceDeleted | null> {
    const id = RunnerPoolId.of(command.poolId);

    try {
      const standing = await this.pools.find(id);
      const cleared = standing
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

      standing.assertVersion(command.expectedVersion);

      await this.transaction.run(() =>
        this.pools.save(
          standing.retired(Attribution.of(command.actor, cleared.workspaceId)),
        ),
      );

      return { outcome: 'deleted' };
    } catch (error) {
      if (error instanceof RunnerPoolVersionConflictError) {
        const current = await this.pools.find(id);

        return current
          ? { outcome: 'version-conflict', currentVersion: current.version }
          : null;
      }

      rethrowAsFault(error);
    }
  }
}
