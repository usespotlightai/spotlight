import type { PersonReaderPort } from '@identity/application/ports/person-reader.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { PeoplePort } from '@insights/application/ports/people.port';
import type { TeamViewer } from '@insights/domain/value-objects/viewed-team.vo';
import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class People implements PeoplePort {
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly people: PersonReaderPort,
  ) {}

  async viewerOf(
    teamId: TeamId,
    principal: Principal,
  ): Promise<TeamViewer | null> {
    const permissions = await this.access.permissionsAsTeamMember(
      teamId,
      principal,
    );
    return permissions
      ? { workspaceId: permissions.workspaceId, by: principal.userId }
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

    return new Map(
      [...found.values()].map((each) => [each.id.value, each.name]),
    );
  }
}
