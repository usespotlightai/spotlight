import type { ConfigurationDto } from '@configuration/application/dto/configuration.dto';
import type { ConfigurationReaderPort } from '@configuration/application/ports/configuration-reader.port';
import type { TeamsPort } from '@configuration/application/ports/teams.port';
import type { ConfigurationQuery } from '@configuration/application/queries/read-configuration.query';
import { connectionStatusOf } from '@configuration/domain/services/integration-connection-status';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class ConfigurationHandler
  implements QueryHandlerPort<ConfigurationQuery, ConfigurationDto | null>
{
  constructor(
    private readonly teams: TeamsPort,
    private readonly configurations: ConfigurationReaderPort,
  ) {}

  async execute(query: ConfigurationQuery): Promise<ConfigurationDto | null> {
    try {
      const team = await this.teams.viewedBy(
        query.teamId,
        UserId.of(query.viewerId),
      );

      if (!team) {
        return null;
      }

      const view = await this.configurations.of(team.teamId);

      return {
        integrations: view.integrations.map((each) => ({
          integration: each.integration,
          path: each.path,
          name: each.name,
          connectionStatus: connectionStatusOf(
            each.requiresConnection,
            each.connected,
          ),
          actsAs: each.actsAs,
          linkedAccount: each.linkedAccount,
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
