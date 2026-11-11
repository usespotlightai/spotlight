import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { TeamIntegrationsDto } from '@integrations/application/dto/team-integrations.dto';
import type { ConnectedIntegrationsPort } from '@integrations/application/ports/connected-integrations.port';
import type { TeamIntegrationReadingsPort } from '@integrations/application/ports/team-integration-readings.port';
import type { TeamIntegrationsQuery } from '@integrations/application/queries/team-integrations.query';
import { connectionStatusOf } from '@integrations/domain/services/integration-connection-status';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class TeamIntegrationsHandler implements QueryHandlerPort<
  TeamIntegrationsQuery,
  TeamIntegrationsDto | null
> {
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly readings: TeamIntegrationReadingsPort,
    private readonly connected: ConnectedIntegrationsPort,
  ) {}

  async execute(
    query: TeamIntegrationsQuery,
  ): Promise<TeamIntegrationsDto | null> {
    try {
      const team = await this.access.inWorkspaceOfTeam(
        TeamId.of(query.teamId),
        UserId.of(query.viewerId),
      );

      if (!team) {
        return null;
      }

      const [readings, connections] = await Promise.all([
        this.readings.ofTeam(team.teamId),
        this.connected.ofTeam(team.teamId),
      ]);
      const connectionOf = new Map(
        connections.map((each) => [each.integration, each]),
      );

      return {
        integrations: readings.map((each) => ({
          integration: each.integration,
          path: each.path,
          name: each.name,
          connectionStatus: connectionStatusOf(
            each.requiresConnection,
            connectionOf.get(each.integration) ?? null,
          ),
          actsAs: each.actsAs,
          linkedAccount:
            connectionOf.get(each.integration)?.linkedAccount ?? null,
          spec: each.spec
            ? {
                kind: each.spec.kind,
                tools: each.spec.tools,
                readAt: each.spec.readAt.toISOString(),
                problem: each.spec.problem,
              }
            : null,
        })),
      };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
