import { Team } from '@identity/domain/aggregates/team.aggregate';
import type { WorkspaceOpened } from '@identity/domain/events/workspace-opened.event';
import type { TeamRepository } from '@identity/domain/repositories/team.repository';

export const FIRST_TEAM = 'identity.first-team';

export class FirstTeam {
  constructor(private readonly teams: TeamRepository) {}

  async openFor(opened: WorkspaceOpened): Promise<void> {
    if (!opened.firstTeam) {
      return;
    }

    const team = Team.open({
      id: opened.firstTeam.id,
      workspaceId: opened.workspaceId,
      name: opened.firstTeam.name,
      openedBy: opened.owner,
      by: opened.change.by,
    });

    await this.teams.add(team);
  }
}
