import type { PersonReaderPort } from '@identity/application/ports/person-reader.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { HostConnectionsDto } from '@integrations/application/dto/host-connections.dto';
import type { DefinedIntegrationsPort } from '@integrations/application/ports/defined-integrations.port';
import type { HostConnectionRosterPort } from '@integrations/application/ports/host-connection-roster.port';
import type { ListHostConnectionsQuery } from '@integrations/application/queries/list-host-connections.query';
import type { PersonToolPolicyRepository } from '@integrations/domain/repositories/person-tool-policy.repository';
import { ToolName } from '@integrations/domain/value-objects/tool-name.vo';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class ListHostConnectionsHandler
  implements
    QueryHandlerPort<ListHostConnectionsQuery, HostConnectionsDto | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly roster: HostConnectionRosterPort,
    private readonly people: PersonReaderPort,
    private readonly defined: DefinedIntegrationsPort,
    private readonly policies: PersonToolPolicyRepository,
  ) {}

  async execute(
    query: ListHostConnectionsQuery,
  ): Promise<HostConnectionsDto | null> {
    try {
      const membership = await this.access.onTeam(
        query.teamId,
        UserId.of(query.viewerId),
      );

      if (!membership) {
        return null;
      }

      const teamId = TeamId.of(query.teamId);
      const viewer = UserId.of(query.viewerId);
      const [held, defined, policies] = await Promise.all([
        this.roster.ofTeam(teamId),
        this.defined.ofTeam(teamId),
        this.policies.ofPerson(teamId, viewer),
      ]);
      const mine = held
        .filter((each) => each.personId === query.viewerId)
        .map(({ source, handle, connectedAt }) => {
          const policy = policies.find((each) => each.source.value === source);

          return {
            source,
            handle,
            connectedAt,
            tools: (
              defined.find((each) => each.source === source)?.offers ?? []
            ).map((tool) => ({
              tool,
              rule: policy?.ruleFor(ToolName.of(tool)).name ?? 'allowed',
            })),
          };
        });

      if (!membership.administers) {
        return { mine, people: null };
      }

      const named = await this.people.findMany(
        [...new Set(held.map((each) => each.personId))].map((id) =>
          UserId.of(id),
        ),
      );

      return {
        mine,
        people: held.map((each) => ({
          source: each.source,
          personId: each.personId,
          name: named.get(each.personId)?.name ?? '',
          handle: each.handle,
          connectedAt: each.connectedAt,
        })),
      };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
