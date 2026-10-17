import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { DeleteHookCommand } from '@integrations/application/commands/delete-hook.command';
import { HookDefinitionVersionConflictError } from '@integrations/domain/exceptions/hook-definition-version-conflict.error';
import type { HookDefinitionRepository } from '@integrations/domain/repositories/hook-definition.repository';
import { HookDefinitionId } from '@integrations/domain/value-objects/hook-definition-id.vo';
import {
  forbiddenTo,
  type ResourceDeleted,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
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
      const existing = await this.definitions.withId(id);
      const permissions = existing
        ? await this.access.permissionsOnTeam(
            existing.teamId.value,
            command.actor.principal,
          )
        : null;

      if (!existing || !permissions) {
        return null;
      }

      if (!permissions.configures) {
        return forbiddenTo('configure');
      }

      existing.assertVersion(command.expectedVersion);

      await this.transaction.inTransaction(() =>
        this.definitions.save(
          existing.delete(
            Attribution.of(command.actor, permissions.workspaceId),
          ),
        ),
      );

      return { outcome: 'deleted' };
    } catch (error) {
      if (error instanceof HookDefinitionVersionConflictError) {
        const current = await this.definitions.withId(id);

        return current
          ? { outcome: 'version-conflict', currentVersion: current.version }
          : null;
      }

      rethrowAsApplicationError(error);
    }
  }
}
