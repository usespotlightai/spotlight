import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { DeleteWorkspaceRunnersCommand } from '@runners/application/commands/runner-resource.commands';
import { WorkspaceRunnersMovedOnError } from '@runners/domain/exceptions/workspace-runners-moved-on.error';
import type { WorkspaceRunnersRepository } from '@runners/domain/repositories/workspace-runners.repository';
import { WorkspaceRunnersId } from '@runners/domain/value-objects/workspace-runners-id.vo';
import {
  forbiddenTo,
  type ResourceDeleted,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';

export class DeleteWorkspaceRunnersHandler
  implements
    CommandHandlerPort<DeleteWorkspaceRunnersCommand, ResourceDeleted | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly declarations: WorkspaceRunnersRepository,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(
    command: DeleteWorkspaceRunnersCommand,
  ): Promise<ResourceDeleted | null> {
    const id = WorkspaceRunnersId.of(command.declarationId);

    try {
      const standing = await this.declarations.find(id);
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

      await this.transaction.run(() =>
        this.declarations.save(
          standing.dropped(Attribution.of(command.actor, cleared.workspaceId)),
        ),
      );

      return { outcome: 'deleted' };
    } catch (error) {
      if (error instanceof WorkspaceRunnersMovedOnError) {
        const current = await this.declarations.find(id);

        return current
          ? { outcome: 'moved-on', currentVersion: current.version }
          : null;
      }

      rethrowAsFault(error);
    }
  }
}
