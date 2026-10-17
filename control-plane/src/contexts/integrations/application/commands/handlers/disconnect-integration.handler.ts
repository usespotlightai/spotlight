import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { DisconnectIntegrationCommand } from '@integrations/application/commands/disconnect-integration.command';
import type { IntegrationConnectionRepository } from '@integrations/domain/repositories/integration-connection.repository';
import { ConnectionOwner } from '@integrations/domain/value-objects/connection-owner.vo';
import { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class DisconnectIntegrationHandler
  implements CommandHandlerPort<DisconnectIntegrationCommand, boolean>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly connections: IntegrationConnectionRepository,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(command: DisconnectIntegrationCommand): Promise<boolean> {
    try {
      const viewer = UserId.of(command.viewerId);

      if (!(await this.access.onTeam(command.teamId, viewer))) {
        return false;
      }

      const connection = await this.connections.of(
        TeamId.of(command.teamId),
        IntegrationKey.of(command.integration),
        ConnectionOwner.person(viewer),
      );

      if (connection) {
        await this.transaction.inTransaction(() =>
          this.connections.remove(connection.disconnect()),
        );
      }

      return true;
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
