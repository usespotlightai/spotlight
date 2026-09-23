import type { ConfigurationDto } from '@configuration/application/dto/configuration.dto';
import type { ConfigurationReaderPort } from '@configuration/application/ports/configuration-reader.port';
import type { IntegrationLinksPort } from '@configuration/application/ports/integration-links.port';
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
    private readonly connections: IntegrationLinksPort,
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

      const [view, links] = await Promise.all([
        this.configurations.of(team.teamId),
        this.connections.heldBy(team.teamId),
      ]);
      const linked = new Map(links.map((each) => [each.source, each]));

      return {
        integrations: view.integrations.map((each) => {
          const link = linked.get(each.source);

          return {
            source: each.source,
            path: each.path,
            name: each.name,
            standing: standingOf(each.connectable, link !== undefined),
            handle: link?.handle ?? null,
          };
        }),
      };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
