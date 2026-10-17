import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { DeleteRunnerTrustCommand } from '@runners/application/commands/runner-resource.commands';
import { RunnerTrustVersionConflictError } from '@runners/domain/exceptions/runner-trust-version-conflict.error';
import type { RunnerTrustRepository } from '@runners/domain/repositories/runner-trust.repository';
import { RunnerTrustId } from '@runners/domain/value-objects/runner-trust-id.vo';
import {
  forbiddenTo,
  type ResourceDeleted,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';

export class DeleteRunnerTrustHandler
  implements
    CommandHandlerPort<DeleteRunnerTrustCommand, ResourceDeleted | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly trusts: RunnerTrustRepository,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(
    command: DeleteRunnerTrustCommand,
  ): Promise<ResourceDeleted | null> {
    const id = RunnerTrustId.of(command.trustId);

    try {
      const standing = await this.trusts.find(id);
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
        this.trusts.save(
          standing.withdrawn(
            Attribution.of(command.actor, cleared.workspaceId),
          ),
        ),
      );

      return { outcome: 'deleted' };
    } catch (error) {
      if (error instanceof RunnerTrustVersionConflictError) {
        const current = await this.trusts.find(id);

        return current
          ? { outcome: 'version-conflict', currentVersion: current.version }
          : null;
      }

      rethrowAsFault(error);
    }
  }
}
