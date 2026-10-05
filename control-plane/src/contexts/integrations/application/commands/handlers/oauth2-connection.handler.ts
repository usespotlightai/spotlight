import type {
  TeamMembership,
  WorkspaceAccessPort,
} from '@identity/application/ports/workspace-access.port';
import type { BeginOAuth2ConnectionCommand } from '@integrations/application/commands/begin-oauth2-connection.command';
import type { FinishOAuth2ConnectionCommand } from '@integrations/application/commands/finish-oauth2-connection.command';
import type { DefinedIntegrationsPort } from '@integrations/application/ports/defined-integrations.port';
import type { IntegrationRuntimePort } from '@integrations/application/ports/integration-runtime.port';
import type {
  OAuth2Begun,
  OAuth2Holding,
  OAuth2LinkingPort,
} from '@integrations/application/ports/oauth2-linking.port';
import { landingBack } from '@integrations/application/services/landing-back';
import { HostConnection } from '@integrations/domain/aggregates/host-connection.aggregate';
import type { HostConnectionRepository } from '@integrations/domain/repositories/host-connection.repository';
import { ConnectionHolder } from '@integrations/domain/value-objects/connection-holder.vo';
import { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

const holderFor = (holding: OAuth2Holding, by: string): ConnectionHolder =>
  holding === 'person'
    ? ConnectionHolder.person(UserId.of(by))
    : ConnectionHolder.team();

const mayConnect = (
  membership: TeamMembership | null,
  holder: ConnectionHolder,
): membership is TeamMembership =>
  membership !== null && (holder.isPerson || membership.administers);

const takesConnection = async (
  defined: DefinedIntegrationsPort,
  runtime: IntegrationRuntimePort,
  teamId: string,
  source: SourceKey,
  holder: ConnectionHolder,
): Promise<boolean> =>
  runtime
    .integrations(await defined.ofTeam(TeamId.of(teamId)))
    .find((each) => each.source.equals(source))
    ?.takesConnectionFrom(holder) ?? false;

export class BeginOAuth2ConnectionHandler
  implements
    CommandHandlerPort<BeginOAuth2ConnectionCommand, OAuth2Begun | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly defined: DefinedIntegrationsPort,
    private readonly runtime: IntegrationRuntimePort,
    private readonly linking: OAuth2LinkingPort,
  ) {}

  async execute(
    command: BeginOAuth2ConnectionCommand,
  ): Promise<OAuth2Begun | null> {
    try {
      const holder = holderFor(command.holder, command.viewerId);
      const membership = await this.access.onTeam(
        command.teamId,
        UserId.of(command.viewerId),
      );

      if (!mayConnect(membership, holder)) {
        return null;
      }

      if (
        !(await takesConnection(
          this.defined,
          this.runtime,
          command.teamId,
          SourceKey.of(command.source),
          holder,
        ))
      ) {
        return null;
      }

      return await this.linking.begin({
        teamId: command.teamId,
        source: command.source,
        by: command.viewerId,
        holder: command.holder,
        back: landingBack(command.back),
      });
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
    private readonly defined: DefinedIntegrationsPort,
    private readonly runtime: IntegrationRuntimePort,
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

      const holder = holderFor(authorized.holder, authorized.by);
      const membership = await this.access.onTeam(
        authorized.teamId,
        UserId.of(authorized.by),
      );

      const source = SourceKey.of(authorized.source);

      if (
        !mayConnect(membership, holder) ||
        !(await takesConnection(
          this.defined,
          this.runtime,
          authorized.teamId,
          source,
          holder,
        ))
      ) {
        return null;
      }

      const connection = HostConnection.linkedFrom({
        workspaceId: membership.workspaceId,
        teamId: TeamId.of(authorized.teamId),
        source,
        holder,
        grant: authorized.grant,
      });

      await this.transaction.run(() => this.connections.save(connection));

      return await this.linking.landingFor(
        authorized.teamId,
        authorized.source,
        authorized.back,
      );
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
