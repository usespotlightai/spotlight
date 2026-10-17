import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { DeleteIntegrationCommand } from '@integrations/application/commands/delete-integration.command';
import type { EnabledTools } from '@integrations/application/services/enabled-tools.service';
import { IntegrationDefinitionVersionConflictError } from '@integrations/domain/exceptions/integration-definition-version-conflict.error';
import { IntegrationToolsInUseError } from '@integrations/domain/exceptions/integration-tools-in-use.error';
import type { IntegrationDefinitionRepository } from '@integrations/domain/repositories/integration-definition.repository';
import { IntegrationDefinitionId } from '@integrations/domain/value-objects/integration-definition-id.vo';
import {
  forbiddenTo,
  type ResourceDeleted,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';

export class DeleteIntegrationHandler
  implements
    CommandHandlerPort<DeleteIntegrationCommand, ResourceDeleted | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly definitions: IntegrationDefinitionRepository,
    private readonly enabledTools: EnabledTools,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(
    command: DeleteIntegrationCommand,
  ): Promise<ResourceDeleted | null> {
    const id = IntegrationDefinitionId.of(command.integrationId);

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

      const enabled = await this.enabledTools.onTeam(existing.teamId);

      await this.transaction.inTransaction(() =>
        this.definitions.save(
          existing.delete(
            enabled,
            Attribution.of(command.actor, permissions.workspaceId),
          ),
        ),
      );

      return { outcome: 'deleted' };
    } catch (error) {
      if (error instanceof IntegrationDefinitionVersionConflictError) {
        const current = await this.definitions.withId(id);

        return current
          ? { outcome: 'version-conflict', currentVersion: current.version }
          : null;
      }

      if (error instanceof IntegrationToolsInUseError) {
        return { outcome: 'in-use', reason: error.message };
      }

      rethrowAsApplicationError(error);
    }
  }
}
