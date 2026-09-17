import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { BeginOAuth2ConnectionCommand } from '@integrations/application/commands/begin-oauth2-connection.command';
import type { FinishOAuth2ConnectionCommand } from '@integrations/application/commands/finish-oauth2-connection.command';
import type {
  OAuth2Begun,
  OAuth2LinkingPort,
} from '@integrations/application/ports/oauth2-linking.port';
import { HostConnection } from '@integrations/domain/aggregates/host-connection.aggregate';
import type { HostConnectionRepository } from '@integrations/domain/repositories/host-connection.repository';
import { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class BeginOAuth2ConnectionHandler
  implements
    CommandHandlerPort<BeginOAuth2ConnectionCommand, OAuth2Begun | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly linking: OAuth2LinkingPort,
  ) {}

  async execute(
    command: BeginOAuth2ConnectionCommand,
  ): Promise<OAuth2Begun | null> {
    try {
      if (
        !(await this.access.onTeam(command.teamId, UserId.of(command.viewerId)))
          ?.administers
      ) {
        return null;
      }

      return await this.linking.begin(
        command.teamId,
        command.source,
        command.viewerId,
      );
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}

export class FinishOAuth2ConnectionHandler
  implements CommandHandlerPort<FinishOAuth2ConnectionCommand, string | null>
{
  constructor(
    private readonly linking: OAuth2LinkingPort,
    private readonly connections: HostConnectionRepository,
    private readonly access: WorkspaceAccessPort,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(
    command: FinishOAuth2ConnectionCommand,
  ): Promise<string | null> {
    try {
      const authorized = await this.linking.authorized({
        state: command.state,
        code: command.code,
        nonce: command.nonce,
        viewerId: command.viewerId,
      });

      if (!authorized) {
        return null;
      }

      if (
        !(await this.access.onTeam(authorized.teamId, UserId.of(authorized.by)))
          ?.administers
      ) {
        return null;
      }

      const connection = HostConnection.linkedFrom({
        teamId: TeamId.of(authorized.teamId),
        source: SourceKey.of(authorized.source),
        grant: authorized.grant,
      });

      await this.transaction.run(() => this.connections.save(connection));

      return await this.linking.landingFor(
        authorized.teamId,
        authorized.source,
      );
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
