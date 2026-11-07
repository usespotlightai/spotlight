import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { CallCredentialsPort } from '@integrations/application/ports/call-credentials.port';
import type {
  ActiveConnection,
  CallAuth,
  Credentials,
} from '@integrations/application/ports/integration-runtime.port';
import type { ConnectionRefresh } from '@integrations/application/services/connection-refresh.service';
import type { IntegrationConnection } from '@integrations/domain/aggregates/integration-connection.aggregate';
import type { IntegrationConnectionRepository } from '@integrations/domain/repositories/integration-connection.repository';
import { ConnectionChoice } from '@integrations/domain/services/connection-choice';
import type { ConnectionMissing } from '@integrations/domain/value-objects/connection-missing.vo';
import { ConnectionOwner } from '@integrations/domain/value-objects/connection-owner.vo';
import type { Integration } from '@integrations/domain/value-objects/integration.vo';
import type { RunAttemptRef } from '@integrations/domain/value-objects/run-attempt-ref.vo';
import type { SecretInjectionPort } from '@secrets/application/ports/secret-injection.port';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface RunCallAuth {
  readonly teamId: TeamId;
  readonly workspaceId: WorkspaceId;
  readonly run: RunAttemptRef;
  readonly injectedSecrets: readonly SecretName[];
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
    private readonly credentials: CallCredentialsPort,
    private readonly connectionRefresh: ConnectionRefresh,
  ) {}

  async of(teamId: TeamId, integration: Integration): Promise<CallAuth> {
    const owner = ConnectionChoice.forUnrequestedCall(integration);
    const connection = owner
      ? await this.connections.of(teamId, integration.key, owner)
      : null;

    let found: Promise<WorkspaceId> | null = null;
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
      credentials: this.credentials.forSpotlight(workspace),
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
          ? (await this.access.inWorkspaceOfTeam(teamId, requester)) !== null
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
        workspaceId: run.workspaceId.value,
        runId: run.run.runId.value,
        attempt: run.run.attempt,
        secrets: run.injectedSecrets.map((each) => each.value),
      });
    }

    const credentials: Credentials = this.credentials.forRun(run);

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

  private async workspaceOf(teamId: TeamId): Promise<WorkspaceId> {
    const team = await this.teams.find(teamId);

    if (!team) {
      throw new InconsistentStateError(
        'integration',
        `belongs to team ${teamId.value}, which no workspace has`,
      );
    }

    return team.workspaceId;
  }
}
