import type {
  TeamWorkspaceMembership,
  WorkspaceAccessPort,
} from '@identity/application/ports/workspace-access.port';
import type { WorkspaceOutboundScopePort } from '@identity/application/ports/workspace-outbound-scope.port';
import type { BeginOAuth2ConnectionCommand } from '@integrations/application/commands/begin-oauth2-connection.command';
import type { FinishOAuth2ConnectionCommand } from '@integrations/application/commands/finish-oauth2-connection.command';
import {
  OAuth2ConnectionNotBegunError,
  type OAuth2NotBegunReason,
} from '@integrations/application/errors/oauth2-connection-not-begun.error';
import type { DefinedIntegrationsPort } from '@integrations/application/ports/defined-integrations.port';
import type { IntegrationRuntimePort } from '@integrations/application/ports/integration-runtime.port';
import type {
  OAuth2LinkingPort,
  OAuth2Refusal,
  OAuth2Start,
} from '@integrations/application/ports/oauth2-linking.port';
import type { OAuth2ClientResolution } from '@integrations/application/services/oauth2-client-resolution.service';
import { IntegrationConnection } from '@integrations/domain/aggregates/integration-connection.aggregate';
import type { IntegrationConnectionRepository } from '@integrations/domain/repositories/integration-connection.repository';
import { ActsAs } from '@integrations/domain/value-objects/acts-as.vo';
import { ConnectionOwner } from '@integrations/domain/value-objects/connection-owner.vo';
import { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
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
  teamId: TeamId,
  integration: IntegrationKey,
  owner: ConnectionOwner,
): Promise<boolean> =>
  runtime
    .integrations(await defined.ofTeam(teamId))
    .find((each) => each.key.equals(integration))
    ?.takesConnectionFrom(owner) ?? false;

export class BeginOAuth2ConnectionHandler implements CommandHandlerPort<
  BeginOAuth2ConnectionCommand,
  OAuth2Start
> {
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly defined: DefinedIntegrationsPort,
    private readonly runtime: IntegrationRuntimePort,
    private readonly linking: OAuth2LinkingPort,
    private readonly clients: OAuth2ClientResolution,
    private readonly scope: WorkspaceOutboundScopePort,
    private readonly logger: LoggerPort,
  ) {}

  async execute(command: BeginOAuth2ConnectionCommand): Promise<OAuth2Start> {
    try {
      const viewer = UserId.of(command.viewerId);
      const teamId = TeamId.of(command.teamId);
      const integration = IntegrationKey.of(command.integration);
      const owner = ConnectionOwner.actingAs(
        ActsAs.chosen(command.actsAs),
        viewer,
      );
      const membership = await this.access.inWorkspaceOfTeam(teamId, viewer);

      const about = {
        teamId: teamId.value,
        integration: integration.value,
        owner: owner.kind,
      };
      const notBegun = (reason: OAuth2NotBegunReason): never => {
        this.logger.info(
          { ...about, reason },
          'Did not begin an OAuth2 connection',
        );
        throw new OAuth2ConnectionNotBegunError(reason, about);
      };

      if (!membership) {
        return notBegun('not-a-member');
      }

      if (!mayConnect(membership, owner, viewer)) {
        return notBegun('not-allowed');
      }

      if (
        !(await takesConnection(
          this.defined,
          this.runtime,
          teamId,
          integration,
          owner,
        ))
      ) {
        return notBegun('takes-no-connection');
      }

      return await this.scope.within(membership.workspaceId, async () => {
        const registration = await this.linking.registrationFor(
          teamId,
          integration,
        );

        if (!registration) {
          return notBegun('no-oauth2-endpoints');
        }

        const client = await this.clients.clientFor(
          teamId,
          integration,
          registration.endpoint,
          registration.server,
        );

        if (!client) {
          return notBegun(
            registration.endpoint === null ? 'no-client' : 'not-registered',
          );
        }

        const started = await this.linking.begin(
          {
            teamId,
            integration,
            by: viewer,
            owner: owner.kind,
            returnTo: command.returnTo,
          },
          client,
        );

        return started ?? notBegun('not-begun');
      });
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}

export class FinishOAuth2ConnectionHandler implements CommandHandlerPort<
  FinishOAuth2ConnectionCommand,
  string | null
> {
  constructor(
    private readonly linking: OAuth2LinkingPort,
    private readonly connections: IntegrationConnectionRepository,
    private readonly access: WorkspaceAccessPort,
    private readonly defined: DefinedIntegrationsPort,
    private readonly runtime: IntegrationRuntimePort,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
    private readonly logger: LoggerPort,
  ) {}

  async execute(
    command: FinishOAuth2ConnectionCommand,
  ): Promise<string | null> {
    try {
      const authorized = await this.linking.authorized({
        state: command.state,
        code: command.code,
        nonce: command.nonce,
        viewerId:
          command.viewerId === null ? null : UserId.of(command.viewerId),
      });

      if ('refused' in authorized) {
        return this.notFinished({
          teamId: authorized.teamId?.value,
          integration: authorized.integration?.value,
          reason: authorized.refused,
        });
      }

      const { by, teamId, integration } = authorized;
      const owner = ConnectionOwner.ofKind(authorized.owner, by);
      const membership = await this.access.inWorkspaceOfTeam(teamId, by);
      const about = {
        teamId: teamId.value,
        integration: integration.value,
        owner: owner.kind,
      };

      if (!mayConnect(membership, owner, by)) {
        return this.notFinished({ ...about, reason: 'not-allowed' });
      }

      if (
        !(await takesConnection(
          this.defined,
          this.runtime,
          teamId,
          integration,
          owner,
        ))
      ) {
        return this.notFinished({ ...about, reason: 'takes-no-connection' });
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
        teamId,
        integration,
        authorized.returnTo,
      );
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }

  private notFinished(fields: {
    readonly reason: OAuth2Refusal | 'not-allowed' | 'takes-no-connection';
    readonly teamId?: string;
    readonly integration?: string;
    readonly owner?: string;
  }): null {
    this.logger.info(fields, 'Did not finish an OAuth2 connection');
    return null;
  }
}
