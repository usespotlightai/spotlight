import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const WORK_TEAMS = Symbol('WORK_TEAMS');

export interface ProjectedTeam {
  readonly teamId: TeamId;
  readonly key: string;
}

export interface WorkTeamsPort {
  project(team: ProjectedTeam): Promise<void>;

  forget(teamId: TeamId): Promise<void>;
}
