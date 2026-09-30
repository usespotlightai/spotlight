import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type {
  Membership,
  PeoplePort,
} from '@outcomes/application/ports/people.port';
import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

export class People implements PeoplePort {
  constructor(private readonly access: WorkspaceAccessPort) {}

  async clearedOnTeam(
    teamId: string,
    principal: Principal,
  ): Promise<Membership | null> {
    const cleared = await this.access.clearanceAsTeamReader(teamId, principal);
    return cleared
      ? { workspaceId: cleared.workspaceId, by: principal.userId }
      : null;
  }
}
