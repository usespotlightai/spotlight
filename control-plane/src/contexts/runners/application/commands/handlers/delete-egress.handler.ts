import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { DeleteEgressCommand } from '@runners/application/commands/runner-resource.commands';
import { EgressInUseError } from '@runners/domain/exceptions/egress-in-use.error';
import { EgressMovedOnError } from '@runners/domain/exceptions/egress-moved-on.error';
import type { EgressRepository } from '@runners/domain/repositories/egress.repository';
import type { RunnerPoolRepository } from '@runners/domain/repositories/runner-pool.repository';
import { poolsNaming } from '@runners/domain/services/egress-uses';
import { EgressId } from '@runners/domain/value-objects/egress-id.vo';
import {
  forbiddenTo,
  type ResourceDeleted,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
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

      standing.expecting(command.expectedVersion);

      await this.transaction.run(async () => {
        const locked = (await this.egresses.findToRetire(id)) ?? standing;

        locked.expecting(command.expectedVersion);

        await this.egresses.save(
          locked.retired(
            poolsNaming(
              locked,
              await this.pools.inWorkspace(locked.workspaceId),
            ),
            Attribution.of(command.actor, cleared.workspaceId),
          ),
        );
      });

      return { outcome: 'deleted' };
    } catch (error) {
      if (error instanceof EgressMovedOnError) {
        const current = await this.egresses.find(id);

        return current
          ? { outcome: 'moved-on', currentVersion: current.version }
          : null;
      }

      if (error instanceof EgressInUseError) {
        return { outcome: 'in-use', reason: error.message };
      }

      rethrowAsFault(error);
    }
  }
}
