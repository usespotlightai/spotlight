import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { MemberReaderPort } from '@application/ports/member-reader.port';
import type { PersonSummary } from '@application/ports/person-reader.port';
import type { QueryHandlerPort } from '@application/ports/query-handler.port';
import type { ListMembersQuery } from '@application/queries/list-members.query';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { UserId } from '@domain/value-objects/user-id.vo';

export class ListMembersHandler
  implements QueryHandlerPort<ListMembersQuery, PersonSummary[] | null>
{
  constructor(private readonly members: MemberReaderPort) {}

  async execute(query: ListMembersQuery): Promise<PersonSummary[] | null> {
    try {
      return await this.members.listForTeam(
        TeamId.of(query.teamId),
        UserId.of(query.viewerId),
      );
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
