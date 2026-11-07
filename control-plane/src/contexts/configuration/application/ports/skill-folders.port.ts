import type { SkillFolder } from '@configuration/domain/aggregates/skill-definition.aggregate';
import type { Skill } from '@configuration/domain/value-objects/skill.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const TEAM_SKILL_FOLDERS = Symbol('TEAM_SKILL_FOLDERS');

export interface SkillFile {
  readonly path: string;
  readonly text: string;
}

export interface ReadSkillFolder {
  readonly skill: Skill;
  readonly files: readonly SkillFile[];
}

export type SkillOrigin = 'defined' | 'built-in';

export interface TeamSkillFoldersPort {
  of(teamId: TeamId): Promise<readonly SkillFolder[]>;
}
