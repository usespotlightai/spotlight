import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { DeleteIntegrationCommand } from '@integrations/application/commands/delete-integration.command';
import type { ToolsGiven } from '@integrations/application/services/tools-given.service';
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
    private readonly given: ToolsGiven,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(
    command: DeleteIntegrationCommand,
  ): Promise<ResourceDeleted | null> {
    const id = IntegrationDefinitionId.of(command.integrationId);

    try {
      const standing = await this.definitions.withId(id);
      const permissions = standing
        ? await this.access.permissionsOnTeam(
            standing.teamId.value,
            command.actor.principal,
          )
        : null;

      if (!standing || !permissions) {
        return null;
      }

      if (!permissions.configures) {
        return forbiddenTo('configure');
      }

      standing.assertVersion(command.expectedVersion);

      const given = await this.given.onTeam(standing.teamId);

      await this.transaction.inTransaction(() =>
        this.definitions.save(
          standing.retire(
            given,
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
