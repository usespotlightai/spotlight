import type {
  TeamMembership,
  WorkspaceAccessPort,
} from '@identity/application/ports/workspace-access.port';
import type { BeginOAuth2ConnectionCommand } from '@integrations/application/commands/begin-oauth2-connection.command';
import type { FinishOAuth2ConnectionCommand } from '@integrations/application/commands/finish-oauth2-connection.command';
import type { DefinedIntegrationsPort } from '@integrations/application/ports/defined-integrations.port';
import type { IntegrationRuntimePort } from '@integrations/application/ports/integration-runtime.port';
import type {
  ConnectionOwnerKind,
  OAuth2LinkingPort,
  OAuth2Start,
} from '@integrations/application/ports/oauth2-linking.port';
import { returnPathOf } from '@integrations/application/services/return-to';
import { IntegrationConnection } from '@integrations/domain/aggregates/integration-connection.aggregate';
import type { IntegrationConnectionRepository } from '@integrations/domain/repositories/integration-connection.repository';
import { ConnectionOwner } from '@integrations/domain/value-objects/connection-owner.vo';
import { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

const ownerFor = (kind: ConnectionOwnerKind, by: string): ConnectionOwner =>
  kind === 'person'
    ? ConnectionOwner.person(UserId.of(by))
    : ConnectionOwner.team();

const mayConnect = (
  membership: TeamMembership | null,
  owner: ConnectionOwner,
): membership is TeamMembership =>
  membership !== null && (owner.isPerson || membership.administers);

const takesConnection = async (
  defined: DefinedIntegrationsPort,
  runtime: IntegrationRuntimePort,
  teamId: string,
  integration: IntegrationKey,
  owner: ConnectionOwner,
): Promise<boolean> =>
  runtime
    .integrations(await defined.ofTeam(TeamId.of(teamId)))
    .find((each) => each.key.equals(integration))
    ?.takesConnectionFrom(owner) ?? false;

export class BeginOAuth2ConnectionHandler
  implements
    CommandHandlerPort<BeginOAuth2ConnectionCommand, OAuth2Start | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly defined: DefinedIntegrationsPort,
    private readonly runtime: IntegrationRuntimePort,
    private readonly linking: OAuth2LinkingPort,
  ) {}

  async execute(
    command: BeginOAuth2ConnectionCommand,
  ): Promise<OAuth2Start | null> {
    try {
      const owner = ownerFor(command.owner, command.viewerId);
      const membership = await this.access.onTeam(
        command.teamId,
        UserId.of(command.viewerId),
      );

      if (!mayConnect(membership, owner)) {
        return null;
      }

      if (
        !(await takesConnection(
          this.defined,
          this.runtime,
          command.teamId,
          IntegrationKey.of(command.integration),
          owner,
        ))
      ) {
        return null;
      }

      return await this.linking.begin({
        teamId: command.teamId,
        integration: command.integration,
        by: command.viewerId,
        owner: command.owner,
        returnTo: returnPathOf(command.returnTo),
      });
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}

export class FinishOAuth2ConnectionHandler
  implements CommandHandlerPort<FinishOAuth2ConnectionCommand, string | null>
{
  constructor(
    private readonly linking: OAuth2LinkingPort,
    private readonly connections: IntegrationConnectionRepository,
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

      const owner = ownerFor(authorized.owner, authorized.by);
      const membership = await this.access.onTeam(
        authorized.teamId,
        UserId.of(authorized.by),
      );

      const integration = IntegrationKey.of(authorized.integration);

      if (
        !mayConnect(membership, owner) ||
        !(await takesConnection(
          this.defined,
          this.runtime,
          authorized.teamId,
          integration,
          owner,
        ))
      ) {
        return null;
      }

      const connection = IntegrationConnection.connectFrom({
        workspaceId: membership.workspaceId,
        teamId: TeamId.of(authorized.teamId),
        integration,
        owner,
        tokens: authorized.tokens,
      });

      await this.transaction.inTransaction(() =>
        this.connections.save(connection),
      );

      return await this.linking.landingFor(
        authorized.teamId,
        authorized.integration,
        authorized.returnTo,
      );
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
