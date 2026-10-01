import type { PersonReaderPort } from '@identity/application/ports/person-reader.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type {
  Membership,
  PeoplePort,
} from '@outcomes/application/ports/people.port';
import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class People implements PeoplePort {
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly people: PersonReaderPort,
  ) {}

  async clearedOnTeam(
    teamId: string,
    principal: Principal,
  ): Promise<Membership | null> {
    const cleared = await this.access.clearanceAsTeamReader(teamId, principal);
    return cleared
      ? { workspaceId: cleared.workspaceId, by: principal.userId }
      : null;
  }

  async namesOf(
    userIds: readonly string[],
  ): Promise<ReadonlyMap<string, string>> {
    if (userIds.length === 0) {
      return new Map();
    }

    const found = await this.people.findMany(
      [...new Set(userIds)].map((each) => UserId.of(each)),
    );

    return new Map([...found.values()].map((each) => [each.id, each.name]));
  }
}
