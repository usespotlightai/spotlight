import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { DeleteHookCommand } from '@integrations/application/commands/delete-hook.command';
import { HookDefinitionMovedOnError } from '@integrations/domain/exceptions/hook-definition-moved-on.error';
import type { HookDefinitionRepository } from '@integrations/domain/repositories/hook-definition.repository';
import { HookDefinitionId } from '@integrations/domain/value-objects/hook-definition-id.vo';
import {
  forbiddenTo,
  type ResourceDeleted,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';

export class DeleteHookHandler
  implements CommandHandlerPort<DeleteHookCommand, ResourceDeleted | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly definitions: HookDefinitionRepository,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(command: DeleteHookCommand): Promise<ResourceDeleted | null> {
    const id = HookDefinitionId.of(command.hookId);

    try {
      const standing = await this.definitions.withId(id);
      const cleared = standing
        ? await this.access.clearanceOnTeam(
            standing.teamId.value,
            command.actor.principal,
          )
        : null;

      if (!standing || !cleared) {
        return null;
      }

      if (!cleared.configures) {
        return forbiddenTo('configure');
      }

      standing.expecting(command.expectedVersion);

      await this.transaction.run(() =>
        this.definitions.save(
          standing.retired(Attribution.of(command.actor, cleared.workspaceId)),
        ),
      );

      return { outcome: 'deleted' };
    } catch (error) {
      if (error instanceof HookDefinitionMovedOnError) {
        const current = await this.definitions.withId(id);

        return current
          ? { outcome: 'moved-on', currentVersion: current.version }
          : null;
      }

      rethrowAsFault(error);
    }
  }
}
