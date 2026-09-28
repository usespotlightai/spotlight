import type { ConfigurationDto } from '@configuration/application/dto/configuration.dto';
import type { ConfigurationReaderPort } from '@configuration/application/ports/configuration-reader.port';
import type { TeamsPort } from '@configuration/application/ports/teams.port';
import type { ConfigurationQuery } from '@configuration/application/queries/read-configuration.query';
import { standingOf } from '@configuration/domain/services/integration-standing';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
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
          source: each.source,
          path: each.path,
          name: each.name,
          standing: standingOf(each.connectable, each.linked),
          handle: each.handle,
        })),
      };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
