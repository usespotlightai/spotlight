import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type {
  ActiveConnection,
  CallAuth,
  Credentials,
} from '@integrations/application/ports/integration-runtime.port';
import type { ConnectionRefresh } from '@integrations/application/services/connection-refresh.service';
import { RunCredentials } from '@integrations/application/services/run-credentials';
import { SpotlightCredentials } from '@integrations/application/services/spotlight-credentials';
import type { IntegrationConnection } from '@integrations/domain/aggregates/integration-connection.aggregate';
import type { Integration } from '@integrations/domain/entities/integration.entity';
import type { IntegrationConnectionRepository } from '@integrations/domain/repositories/integration-connection.repository';
import { ConnectionChoice } from '@integrations/domain/services/connection-choice';
import type { ConnectionMissing } from '@integrations/domain/value-objects/connection-missing.vo';
import { ConnectionOwner } from '@integrations/domain/value-objects/connection-owner.vo';
import type { SecretInjectionPort } from '@secrets/application/ports/secret-injection.port';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export interface RunCallAuth {
  readonly teamId: TeamId;
  readonly workspaceId: string;
  readonly runId: string;
  readonly attempt: number;
  readonly injectedSecrets: readonly string[];
}

export type ConnectionFound =
  | {
      readonly kind: 'chosen';
      readonly owner: ConnectionOwner;
      readonly connection: IntegrationConnection | null;
    }
  | { readonly kind: 'missing'; readonly missing: ConnectionMissing };

export class CallAuthResolver {
  constructor(
    private readonly connections: IntegrationConnectionRepository,
    private readonly teams: TeamDirectoryPort,
    private readonly access: WorkspaceAccessPort,
    private readonly injection: SecretInjectionPort,
    private readonly connectionRefresh: ConnectionRefresh,
  ) {}

  async of(teamId: TeamId, integration: Integration): Promise<CallAuth> {
    const connection = integration.requiresConnection
      ? await this.connections.of(
          teamId,
          integration.key,
          ConnectionOwner.team(),
        )
      : null;

    let found: Promise<string> | null = null;
    const workspace = () => {
      found ??= this.workspaceOf(teamId).catch((error: unknown) => {
        found = null;
        throw error;
      });
      return found;
    };

    return {
      workspace,
      connection: connection ? this.active(connection) : null,
      credentials: new SpotlightCredentials(this.injection, workspace),
    };
  }

  async connectionFor(
    teamId: TeamId,
    integration: Integration,
    requester: UserId | null,
  ): Promise<ConnectionFound> {
    if (!integration.requiresConnection) {
      return {
        kind: 'chosen',
        owner: ConnectionOwner.team(),
        connection: null,
      };
    }

    const chosen = ConnectionChoice.choose(integration, {
      personId: requester,
      member:
        requester !== null && integration.actsAs.byRequester
          ? (await this.access.onTeam(teamId.value, requester)) !== null
          : false,
    });

    if (chosen.kind === 'missing') {
      return chosen;
    }

    const found = await this.connections.of(
      teamId,
      integration.key,
      chosen.owner,
    );
    const missing = ConnectionChoice.usable(integration, chosen.owner, found);

    return missing
      ? { kind: 'missing', missing }
      : { kind: 'chosen', owner: chosen.owner, connection: found };
  }

  async forRun(
    run: RunCallAuth,
    connection: IntegrationConnection | null,
  ): Promise<CallAuth> {
    if (run.injectedSecrets.length > 0) {
      await this.injection.grant({
        workspaceId: run.workspaceId,
        runId: run.runId,
        attempt: run.attempt,
        secrets: run.injectedSecrets,
      });
    }

    const credentials: Credentials = new RunCredentials(this.injection, run);

    return {
      workspace: async () => run.workspaceId,
      connection: connection ? this.active(connection) : null,
      credentials,
    };
  }

  private active(connection: IntegrationConnection): ActiveConnection {
    return {
      token: connection.accessToken,
      owner: connection.owner,
      linkedAccount: connection.linkedAccount,
      unauthorized: (token) =>
        this.connectionRefresh.afterUnauthorized(
          connection.teamId,
          connection.integration,
          connection.owner,
          token,
        ),
    };
  }

  private async workspaceOf(teamId: TeamId): Promise<string> {
    const team = await this.teams.find(teamId);

    if (!team) {
      throw new InconsistentStateError(
        'integration',
        `belongs to team ${teamId.value}, which no workspace has`,
      );
    }

    return team.workspaceId.value;
  }
}
