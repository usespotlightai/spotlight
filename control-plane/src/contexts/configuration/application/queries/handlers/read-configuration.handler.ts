import type { ConfigurationDto } from '@configuration/application/dto/configuration.dto';
import type { ConfigurationReaderPort } from '@configuration/application/ports/configuration-reader.port';
import type { IntegrationLinksPort } from '@configuration/application/ports/integration-links.port';
import type { TeamsPort } from '@configuration/application/ports/teams.port';
import type { ConfigurationQuery } from '@configuration/application/queries/read-configuration.query';
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

      const view = await this.configurations.of(team.teamId);
      const readsFrom = view.keptIn ?? view.read?.repository ?? null;

      if (!view.read) {
        return {
          repository: null,
          readsFrom,
          movingTo: view.movingTo,
          sha: null,
          integrations: [],
        };
      }

      const linked = new Map(
        (await this.connections.heldBy(team.teamId)).map((each) => [
          each.source,
          each,
        ]),
      );

      return {
        repository: view.read.repository,
        readsFrom,
        movingTo: view.movingTo,
        sha: view.read.sha,
        integrations: view.read.integrations.map((each) => ({
          source: each.source,
          path: each.path,
          name: each.name,
          connectable: each.connectable,
          connection: linked.has(each.source)
            ? { handle: linked.get(each.source)?.handle ?? null }
            : null,
        })),
      };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
