import type { PersonReaderPort } from '@identity/application/ports/person-reader.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { HostConnectionsDto } from '@integrations/application/dto/host-connections.dto';
import type { HostConnectionRosterPort } from '@integrations/application/ports/host-connection-roster.port';
import type { ListHostConnectionsQuery } from '@integrations/application/queries/list-host-connections.query';
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

      const held = await this.roster.ofTeam(TeamId.of(query.teamId));
      const mine = held
        .filter((each) => each.personId === query.viewerId)
        .map(({ source, handle, connectedAt }) => ({
          source,
          handle,
          connectedAt,
        }));

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
