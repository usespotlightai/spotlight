import { integrationFilesIn } from '@application/contracts/configuration-layout.contract';
import type { ConfigurationDto } from '@application/dto/configuration.dto';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { IntegrationReaderPort } from '@application/ports/integration-reader.port';
import type { QueryHandlerPort } from '@application/ports/query-handler.port';
import type { WorkspaceReaderPort } from '@application/ports/workspace-reader.port';
import type { ConfigurationQuery } from '@application/queries/read-configuration.query';
import type { HostConnectionRepository } from '@domain/repositories/host-connection.repository';
import type { TeamRepository } from '@domain/repositories/team.repository';
import type { TeamConfigurationRepository } from '@domain/repositories/team-configuration.repository';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { UserId } from '@domain/value-objects/user-id.vo';

export class ConfigurationHandler
  implements QueryHandlerPort<ConfigurationQuery, ConfigurationDto | null>
{
  constructor(
    private readonly workspaces: WorkspaceReaderPort,
    private readonly teams: TeamRepository,
    private readonly configurations: TeamConfigurationRepository,
    private readonly integrations: IntegrationReaderPort,
    private readonly connections: HostConnectionRepository,
  ) {}

  async execute(query: ConfigurationQuery): Promise<ConfigurationDto | null> {
    try {
      const team = await this.workspaces.findTeamForMember(
        query.teamId,
        UserId.of(query.viewerId),
      );

      if (!team) {
        return null;
      }

      const [kept, applied] = await Promise.all([
        this.teams.find(TeamId.of(team.teamId)),
        this.configurations.findFor(TeamId.of(team.teamId)),
      ]);

      const readsFrom =
        kept?.configurationReadFrom(applied?.repository ?? null)?.value ?? null;
      const movingTo = kept?.movingConfigurationTo?.value ?? null;

      if (!applied) {
        return {
          repository: null,
          readsFrom,
          movingTo,
          sha: null,
          integrations: [],
        };
      }

      const read = integrationFilesIn(applied.files).flatMap((file) =>
        this.integrations
          .read([file])
          .integrations.map((each) => ({ each, path: file.path })),
      );
      const linked = new Map(
        (await this.connections.held(TeamId.of(team.teamId))).map((each) => [
          each.source,
          each,
        ]),
      );

      return {
        repository: applied.repository.value,
        readsFrom,
        movingTo,
        sha: applied.commit.value,
        integrations: read.map(({ each, path }) => ({
          source: each.source.value,
          path,
          name: each.name,
          connectable: each.connects,
          connection: linked.has(each.source.value)
            ? { handle: linked.get(each.source.value)?.handle ?? null }
            : null,
        })),
      };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
