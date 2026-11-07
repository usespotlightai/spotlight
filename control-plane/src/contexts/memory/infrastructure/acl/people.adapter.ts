import type { PersonReaderPort } from '@identity/application/ports/person-reader.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { PeoplePort, Person } from '@memory/application/ports/people.port';
import type { TeamViewer } from '@memory/domain/services/team-access';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class People implements PeoplePort {
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly people: PersonReaderPort,
  ) {}

  async viewerOf(teamId: string, userId: string): Promise<TeamViewer | null> {
    const seen = await this.access.inWorkspaceOfTeam(
      TeamId.of(teamId),
      UserId.of(userId),
    );
    return seen ? { workspaceId: seen.workspaceId, by: seen.viewer } : null;
  }

  async find(userId: UserId): Promise<Person | null> {
    const person = await this.people.find(userId);
    return person ? { name: person.name, image: person.image } : null;
  }
}
