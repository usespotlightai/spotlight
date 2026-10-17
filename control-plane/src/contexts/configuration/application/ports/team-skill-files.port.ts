import type { ConfigurationFile } from '@configuration/domain/value-objects/configuration-file.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const TEAM_SKILL_FILES = Symbol('TEAM_SKILL_FILES');

export interface TeamSkillFiles {
  readonly teamId: TeamId;
  readonly skills: readonly ConfigurationFile[];
}

export interface TeamSkillFilesPort {
  of(teamId: TeamId): Promise<TeamSkillFiles>;
}
