import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { DisconnectHostCommand } from '@integrations/application/commands/disconnect-host.command';
import type { HostConnectionRepository } from '@integrations/domain/repositories/host-connection.repository';
import { ConnectionHolder } from '@integrations/domain/value-objects/connection-holder.vo';
import { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class DisconnectHostHandler
  implements CommandHandlerPort<DisconnectHostCommand, boolean>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly connections: HostConnectionRepository,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(command: DisconnectHostCommand): Promise<boolean> {
    try {
      const viewer = UserId.of(command.viewerId);

      if (!(await this.access.onTeam(command.teamId, viewer))) {
        return false;
      }

      const connection = await this.connections.of(
        TeamId.of(command.teamId),
        SourceKey.of(command.source),
        ConnectionHolder.person(viewer),
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
