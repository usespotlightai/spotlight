import type { PersonReaderPort } from '@identity/application/ports/person-reader.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { PeoplePort, Person } from '@memory/application/ports/people.port';
import type { Membership } from '@memory/domain/services/team-access';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class People implements PeoplePort {
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly people: PersonReaderPort,
  ) {}

  async memberOf(teamId: string, userId: string): Promise<Membership | null> {
    const membership = await this.access.onTeam(teamId, UserId.of(userId));
    return membership
      ? { workspaceId: membership.workspaceId, by: membership.viewer }
      : null;
  }

  async find(userId: UserId): Promise<Person | null> {
    const person = await this.people.find(userId);
    return person ? { name: person.name, image: person.image } : null;
  }
}
