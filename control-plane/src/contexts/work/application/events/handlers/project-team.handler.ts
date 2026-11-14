import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type {
  ProjectedTeam,
  WorkTeamsPort,
} from '@work/application/ports/work-teams.port';

export class ProjectTeam {
  constructor(private readonly teams: WorkTeamsPort) {}

  teamCreated(team: ProjectedTeam): Promise<void> {
    return this.teams.project(team);
  }

  teamDeleted(teamId: TeamId): Promise<void> {
    return this.teams.forget(teamId);
  }
}
