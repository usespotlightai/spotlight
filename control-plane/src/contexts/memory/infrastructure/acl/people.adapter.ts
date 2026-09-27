import type { PersonReaderPort } from '@identity/application/ports/person-reader.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type {
  Membership,
  PeoplePort,
} from '@memory/application/ports/people.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class People implements PeoplePort {
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly people: PersonReaderPort,
  ) {}

  async memberOf(teamId: string, userId: string): Promise<Membership | null> {
    const standing = await this.access.onTeam(teamId, UserId.of(userId));
    return standing
      ? { workspaceId: standing.workspaceId, by: standing.viewer }
      : null;
  }

  async nameOf(userId: UserId): Promise<string | null> {
    return (await this.people.find(userId))?.name ?? null;
  }
}
