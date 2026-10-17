import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { DeleteEgressCommand } from '@runners/application/commands/runner-resource.commands';
import { EgressInUseError } from '@runners/domain/exceptions/egress-in-use.error';
import { EgressVersionConflictError } from '@runners/domain/exceptions/egress-version-conflict.error';
import type { EgressRepository } from '@runners/domain/repositories/egress.repository';
import type { RunnerPoolRepository } from '@runners/domain/repositories/runner-pool.repository';
import { poolsNaming } from '@runners/domain/services/egress-uses';
import { EgressId } from '@runners/domain/value-objects/egress-id.vo';
import {
  forbiddenTo,
  type ResourceDeleted,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';

export class DeleteEgressHandler
  implements CommandHandlerPort<DeleteEgressCommand, ResourceDeleted | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly egresses: EgressRepository,
    private readonly pools: RunnerPoolRepository,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(command: DeleteEgressCommand): Promise<ResourceDeleted | null> {
    const id = EgressId.of(command.egressId);

    try {
      const standing = await this.egresses.find(id);
      const permissions = standing
        ? await this.access.permissionsIn(
            standing.workspaceId,
            command.actor.principal,
          )
        : null;

      if (!standing || !permissions) {
        return null;
      }

      if (!permissions.managesRunners) {
        return forbiddenTo('manage-runners');
      }

      standing.assertVersion(command.expectedVersion);

      await this.transaction.inTransaction(async () => {
        const locked = (await this.egresses.findToRetire(id)) ?? standing;

        locked.assertVersion(command.expectedVersion);

        await this.egresses.save(
          locked.retire(
            poolsNaming(
              locked,
              await this.pools.inWorkspace(locked.workspaceId),
            ),
            Attribution.of(command.actor, permissions.workspaceId),
          ),
        );
      });

      return { outcome: 'deleted' };
    } catch (error) {
      if (error instanceof EgressVersionConflictError) {
        const current = await this.egresses.find(id);

        return current
          ? { outcome: 'version-conflict', currentVersion: current.version }
          : null;
      }

      if (error instanceof EgressInUseError) {
        return { outcome: 'in-use', reason: error.message };
      }

      rethrowAsApplicationError(error);
    }
  }
}
