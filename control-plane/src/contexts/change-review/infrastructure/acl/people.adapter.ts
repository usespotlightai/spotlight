import type {
  PeoplePort,
  Person,
  TeamViewer,
} from '@change-review/application/ports/people.port';
import type { PersonReaderPort } from '@identity/application/ports/person-reader.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { PersonPrincipal } from '@shared-kernel/domain/value-objects/principal.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class People implements PeoplePort {
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly people: PersonReaderPort,
  ) {}

  async find(userId: UserId): Promise<Person | null> {
    const person = await this.people.find(userId);
    return person ? { name: person.name, image: person.image } : null;
  }

  async viewerOf(teamId: TeamId, userId: UserId): Promise<TeamViewer | null> {
    const seen = await this.access.inWorkspaceOfTeam(teamId, userId);
    return seen
      ? { workspaceId: seen.workspaceId, teamId: seen.teamId, by: seen.viewer }
      : null;
  }

  async actsForTeam(teamId: TeamId, userId: UserId): Promise<boolean> {
    return (
      (await this.access.permissionsAsTeamMember(
        teamId,
        PersonPrincipal.of(userId),
      )) !== null
    );
  }
}
