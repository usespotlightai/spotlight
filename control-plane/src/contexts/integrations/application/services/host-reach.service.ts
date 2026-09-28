import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type {
  Credentials,
  Reach,
} from '@integrations/application/ports/integration-runtime.port';
import { RunCredentials } from '@integrations/application/services/run-credentials';
import { SpotlightCredentials } from '@integrations/application/services/spotlight-credentials';
import type { Integration } from '@integrations/domain/entities/integration.entity';
import type { HostConnectionRepository } from '@integrations/domain/repositories/host-connection.repository';
import type { SecretInjectionPort } from '@secrets/application/ports/secret-injection.port';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export interface RunReaching {
  readonly teamId: TeamId;
  readonly workspaceId: string;
  readonly runId: string;
  readonly attempt: number;
  readonly wears: readonly string[];
}

export class HostReach {
  constructor(
    private readonly connections: HostConnectionRepository,
    private readonly teams: TeamDirectoryPort,
    private readonly injection: SecretInjectionPort,
  ) {}

  of(teamId: TeamId, integration: Integration): Promise<Reach> {
    return this.reaching(
      teamId,
      integration,
      new SpotlightCredentials(this.injection, () => this.workspaceOf(teamId)),
    );
  }

  async forRun(run: RunReaching, integration: Integration): Promise<Reach> {
    if (run.wears.length > 0) {
      await this.injection.grant({
        workspaceId: run.workspaceId,
        runId: run.runId,
        attempt: run.attempt,
        secrets: run.wears,
      });
    }

    return this.reaching(
      run.teamId,
      integration,
      new RunCredentials(this.injection, run),
    );
  }

  private async reaching(
    teamId: TeamId,
    integration: Integration,
    credentials: Credentials,
  ): Promise<Reach> {
    const connection = integration.connects
      ? await this.connections.of(teamId, integration.source)
      : null;

    return { connection: connection?.accessToken ?? null, credentials };
  }

  private async workspaceOf(teamId: TeamId): Promise<string> {
    const team = await this.teams.find(teamId);

    if (!team) {
      throw new InconsistentStateError(
        'integration',
        `belongs to team ${teamId.value}, which no workspace holds`,
      );
    }

    return team.workspaceId.value;
  }
}
