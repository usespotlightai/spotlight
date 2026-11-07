import type {
  TeamWorkspaceMembership,
  WorkspaceAccessPort,
} from '@identity/application/ports/workspace-access.port';
import type { BeginOAuth2ConnectionCommand } from '@integrations/application/commands/begin-oauth2-connection.command';
import type { FinishOAuth2ConnectionCommand } from '@integrations/application/commands/finish-oauth2-connection.command';
import type { DefinedIntegrationsPort } from '@integrations/application/ports/defined-integrations.port';
import type { IntegrationRuntimePort } from '@integrations/application/ports/integration-runtime.port';
import type {
  OAuth2LinkingPort,
  OAuth2Start,
} from '@integrations/application/ports/oauth2-linking.port';
import type { OAuth2ClientResolution } from '@integrations/application/services/oauth2-client-resolution.service';
import { IntegrationConnection } from '@integrations/domain/aggregates/integration-connection.aggregate';
import type { IntegrationConnectionRepository } from '@integrations/domain/repositories/integration-connection.repository';
import { ConnectionOwner } from '@integrations/domain/value-objects/connection-owner.vo';
import { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { WorkspaceOutboundScopePort } from '@shared-kernel/application/ports/workspace-outbound-scope.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

const mayConnect = (
  membership: TeamWorkspaceMembership | null,
  owner: ConnectionOwner,
  by: UserId,
): membership is TeamWorkspaceMembership =>
  membership !== null && owner.mayBeConnectedBy(by, membership.isAdmin);

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
    private readonly clients: OAuth2ClientResolution,
    private readonly scope: WorkspaceOutboundScopePort,
  ) {}

  async execute(
    command: BeginOAuth2ConnectionCommand,
  ): Promise<OAuth2Start | null> {
    try {
      const viewer = UserId.of(command.viewerId);
      const owner = ConnectionOwner.ofKind(command.owner, viewer);
      const membership = await this.access.inWorkspaceOfTeam(
        TeamId.of(command.teamId),
        viewer,
      );

      if (!mayConnect(membership, owner, viewer)) {
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

      const teamId = TeamId.of(command.teamId);
      const integration = IntegrationKey.of(command.integration);

      return await this.scope.within(membership.workspaceId.value, async () => {
        const registration = await this.linking.registrationFor(
          teamId,
          integration,
        );
        const client = registration
          ? await this.clients.clientFor(
              teamId,
              integration,
              registration.endpoint,
              registration.server,
            )
          : null;

        return client
          ? this.linking.begin(
              {
                teamId: command.teamId,
                integration: command.integration,
                by: command.viewerId,
                owner: command.owner,
                returnTo: command.returnTo,
              },
              client,
            )
          : null;
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
    private readonly clock: ClockPort,
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

      const by = UserId.of(authorized.by);
      const owner = ConnectionOwner.ofKind(authorized.owner, by);
      const membership = await this.access.inWorkspaceOfTeam(
        TeamId.of(authorized.teamId),
        by,
      );
      const teamId = TeamId.of(authorized.teamId);
      const integration = IntegrationKey.of(authorized.integration);

      if (
        !mayConnect(membership, owner, by) ||
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

      await this.transaction.inTransaction(async () => {
        const at = this.clock.now();
        const existing = await this.connections.of(teamId, integration, owner);

        await this.connections.save(
          existing
            ? existing.reconnectedWith(authorized.tokens, at)
            : IntegrationConnection.connectFrom({
                workspaceId: membership.workspaceId,
                teamId,
                integration,
                owner,
                tokens: authorized.tokens,
                at,
              }),
        );
      });

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
