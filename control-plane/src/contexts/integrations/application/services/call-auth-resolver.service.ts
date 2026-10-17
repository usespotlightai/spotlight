import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type {
  ActiveConnection,
  CallAuth,
  Credentials,
} from '@integrations/application/ports/integration-runtime.port';
import type { ConnectionRenewal } from '@integrations/application/services/connection-renewal.service';
import { RunCredentials } from '@integrations/application/services/run-credentials';
import { SpotlightCredentials } from '@integrations/application/services/spotlight-credentials';
import type { HostConnection } from '@integrations/domain/aggregates/host-connection.aggregate';
import type { Integration } from '@integrations/domain/entities/integration.entity';
import type { HostConnectionRepository } from '@integrations/domain/repositories/host-connection.repository';
import { ConnectionChoice } from '@integrations/domain/services/connection-choice';
import { ConnectionHolder } from '@integrations/domain/value-objects/connection-holder.vo';
import type { ConnectionWanted } from '@integrations/domain/value-objects/connection-wanted.vo';
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
      readonly holder: ConnectionHolder;
      readonly connection: HostConnection | null;
    }
  | { readonly kind: 'wanted'; readonly wanted: ConnectionWanted };

export class CallAuthResolver {
  constructor(
    private readonly connections: HostConnectionRepository,
    private readonly teams: TeamDirectoryPort,
    private readonly access: WorkspaceAccessPort,
    private readonly injection: SecretInjectionPort,
    private readonly renewal: ConnectionRenewal,
  ) {}

  async of(teamId: TeamId, integration: Integration): Promise<CallAuth> {
    const connection = integration.connects
      ? await this.connections.of(
          teamId,
          integration.source,
          ConnectionHolder.team(),
        )
      : null;

    return {
      connection: connection ? this.active(connection) : null,
      credentials: new SpotlightCredentials(this.injection, () =>
        this.workspaceOf(teamId),
      ),
    };
  }

  async connectionFor(
    teamId: TeamId,
    integration: Integration,
    requester: UserId | null,
  ): Promise<ConnectionFound> {
    if (!integration.connects) {
      return {
        kind: 'chosen',
        holder: ConnectionHolder.team(),
        connection: null,
      };
    }

    const chosen = ConnectionChoice.choose(integration, {
      personId: requester,
      member:
        requester !== null && integration.holderRule.byRequester
          ? (await this.access.onTeam(teamId.value, requester)) !== null
          : false,
    });

    if (chosen.kind === 'wanted') {
      return chosen;
    }

    const found = await this.connections.of(
      teamId,
      integration.source,
      chosen.holder,
    );
    const wanted = ConnectionChoice.usable(integration, chosen.holder, found);

    return wanted
      ? { kind: 'wanted', wanted }
      : { kind: 'chosen', holder: chosen.holder, connection: found };
  }

  async forRun(
    run: RunCallAuth,
    connection: HostConnection | null,
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
      connection: connection ? this.active(connection) : null,
      credentials,
    };
  }

  private active(connection: HostConnection): ActiveConnection {
    return {
      token: connection.accessToken,
      holder: connection.holder,
      handle: connection.handle,
      unauthorized: (token) =>
        this.renewal.afterUnauthorized(
          connection.teamId,
          connection.source,
          connection.holder,
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
