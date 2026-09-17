import type {
  Membership,
  PeoplePort,
  Person,
} from '@change-review/application/ports/people.port';
import type { PersonReaderPort } from '@identity/application/ports/person-reader.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class People implements PeoplePort {
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly people: PersonReaderPort,
  ) {}

  async find(userId: UserId): Promise<Person | null> {
    const person = await this.people.find(userId);
    return person ? { name: person.name, image: person.image } : null;
  }

  async memberOf(teamId: string, userId: string): Promise<Membership | null> {
    const standing = await this.access.onTeam(teamId, UserId.of(userId));
    return standing
      ? { workspaceId: standing.workspaceId, by: standing.viewer }
      : null;
  }
}
