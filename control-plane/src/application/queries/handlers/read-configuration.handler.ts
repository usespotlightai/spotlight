import type { ConfigurationDto } from '@application/dto/configuration.dto';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { IntegrationReaderPort } from '@application/ports/integration-reader.port';
import type { QueryHandlerPort } from '@application/ports/query-handler.port';
import type { TeamSecretsPort } from '@application/ports/team-secrets.port';
import type { WorkspaceReaderPort } from '@application/ports/workspace-reader.port';
import type { ConfigurationQuery } from '@application/queries/read-configuration.query';
import { INTEGRATIONS_UNDER } from '@domain/aggregates/team-configuration.aggregate';
import type { HostConnectionRepository } from '@domain/repositories/host-connection.repository';
import type { TeamConfigurationRepository } from '@domain/repositories/team-configuration.repository';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { UserId } from '@domain/value-objects/user-id.vo';

/**
 * What a workspace is listening to, and everything wrong with what it wrote.
 * Both together: an integration missing and a file that will not read are the
 * same question asked from two ends.
 */
export class ConfigurationHandler
  implements QueryHandlerPort<ConfigurationQuery, ConfigurationDto | null>
{
  constructor(
    private readonly workspaces: WorkspaceReaderPort,
    private readonly configurations: TeamConfigurationRepository,
    private readonly integrations: IntegrationReaderPort,
    private readonly secrets: TeamSecretsPort,
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

      const applied = await this.configurations.findFor(TeamId.of(team.teamId));

      if (!applied) {
        return {
          repository: null,
          sha: null,
          readAt: null,
          integrations: [],
          problems: [],
        };
      }

      // Only this team's, so two teams reading one repository each see
      // the hosts that are theirs.
      const read = this.integrations.read(applied.under(INTEGRATIONS_UNDER));
      const held = await this.secrets.held(TeamId.of(team.teamId));
      const set = new Set(held.map((each) => each.name));

      const linked = new Map(
        (await this.connections.held(TeamId.of(team.teamId))).map((each) => [
          each.source,
          each,
        ]),
      );

      return {
        repository: applied.repository.value,
        sha: applied.commit.value,
        readAt: applied.readAt.toISOString(),
        integrations: read.integrations.map((each) => ({
          source: each.source.value,
          name: each.name,
          // Where the host is told to knock, which is what a person copies
          // into it. Its own door, so nothing has to be read to place it.
          deliverTo: `/api/webhooks/w/${team.slug}/t/${team.teamKey}/${each.source.value}`,
          // Named rather than shown, and only whether each has been set.
          secrets: each.credentials.map((secret) => ({
            name: secret.value,
            set: set.has(secret.value),
          })),
          happenings: each.declares.map((declared) => ({
            happening: declared.happening.value,
            label: declared.label,
          })),
          connectable: each.connects,
          connection: linked.has(each.source.value)
            ? { handle: linked.get(each.source.value)?.handle ?? null }
            : null,
        })),
        problems: applied.problems.map((each) => ({
          path: each.path,
          at: each.at,
          reason: each.reason,
        })),
      };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
