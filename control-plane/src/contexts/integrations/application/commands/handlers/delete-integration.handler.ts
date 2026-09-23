import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { DeleteIntegrationCommand } from '@integrations/application/commands/delete-integration.command';
import type { ToolsGiven } from '@integrations/application/services/tools-given.service';
import { IntegrationDefinitionMovedOnError } from '@integrations/domain/exceptions/integration-definition-moved-on.error';
import { IntegrationToolsInUseError } from '@integrations/domain/exceptions/integration-tools-in-use.error';
import type { IntegrationDefinitionRepository } from '@integrations/domain/repositories/integration-definition.repository';
import { IntegrationDefinitionId } from '@integrations/domain/value-objects/integration-definition-id.vo';
import type { ResourceDeleted } from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

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
      const membership = standing
        ? await this.access.onTeam(
            standing.teamId.value,
            UserId.of(command.requesterId),
          )
        : null;

      if (!standing || !membership?.administers) {
        return null;
      }

      standing.expecting(command.expectedVersion);

      const given = await this.given.onTeam(standing.teamId);

      await this.transaction.run(() =>
        this.definitions.save(standing.retired(given)),
      );

      return { outcome: 'deleted' };
    } catch (error) {
      if (error instanceof IntegrationDefinitionMovedOnError) {
        const current = await this.definitions.withId(id);

        return current
          ? { outcome: 'moved-on', currentVersion: current.version }
          : null;
      }

      if (error instanceof IntegrationToolsInUseError) {
        return { outcome: 'in-use', reason: error.message };
      }

      rethrowAsFault(error);
    }
  }
}
