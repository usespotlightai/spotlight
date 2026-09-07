import type { BeginOAuth2ConnectionCommand } from '@application/commands/begin-oauth2-connection.command';
import type { FinishOAuth2ConnectionCommand } from '@application/commands/finish-oauth2-connection.command';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@application/ports/command-handler.port';
import type { DomainEventDispatcher } from '@application/ports/domain-event-dispatcher.port';
import type { OAuth2LinkingPort } from '@application/ports/oauth2-linking.port';
import type { TransactionPort } from '@application/ports/transaction.port';
import type { ConnectionAuthorization } from '@application/services/connection-authorization.service';
import { HostConnection } from '@domain/aggregates/host-connection.aggregate';
import type { HostConnectionRepository } from '@domain/repositories/host-connection.repository';
import { SourceKey } from '@domain/value-objects/source-key.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';

/**
 * Begins a team's OAuth2 link to a host, once it is settled that the person may.
 * What comes back is where to send them.
 */
export class BeginOAuth2ConnectionHandler
  implements CommandHandlerPort<BeginOAuth2ConnectionCommand, string | null>
{
  constructor(
    private readonly authorization: ConnectionAuthorization,
    private readonly linking: OAuth2LinkingPort,
  ) {}

  async execute(command: BeginOAuth2ConnectionCommand): Promise<string | null> {
    try {
      if (
        !(await this.authorization.connectableBy(
          command.teamId,
          command.viewerId,
        ))
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

/**
 * Finishes the link when the host sends the person back. The signed state names
 * who began it, and that person is asked once more whether they may connect —
 * the invariant is answered where the connection is written, not only where it
 * was begun. Then the link is made, saved, and announced.
 */
export class FinishOAuth2ConnectionHandler
  implements CommandHandlerPort<FinishOAuth2ConnectionCommand, string | null>
{
  constructor(
    private readonly linking: OAuth2LinkingPort,
    private readonly connections: HostConnectionRepository,
    private readonly authorization: ConnectionAuthorization,
    private readonly transaction: TransactionPort,
    private readonly events: DomainEventDispatcher,
  ) {}

  async execute(
    command: FinishOAuth2ConnectionCommand,
  ): Promise<string | null> {
    try {
      const authorized = await this.linking.authorized(
        command.state,
        command.code,
      );

      if (!authorized) {
        return null;
      }

      if (
        !(await this.authorization.connectableBy(
          authorized.teamId,
          authorized.by,
        ))
      ) {
        return null;
      }

      const connection = HostConnection.linkedFrom({
        teamId: TeamId.of(authorized.teamId),
        source: SourceKey.of(authorized.source),
        grant: authorized.grant,
      });

      await this.transaction.run(() => this.connections.save(connection));
      await this.events.dispatch(connection.pullEvents());

      return await this.linking.landingFor(
        authorized.teamId,
        authorized.source,
      );
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
