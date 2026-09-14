import type { Skill } from '@domain/entities/skill.entity';
import type { ConfigurationFile } from '@domain/value-objects/configuration-file.vo';
import type { ConfigurationProblem } from '@domain/value-objects/configuration-problem.vo';

export const SKILL_READER = Symbol('SKILL_READER');

export interface SkillFile {
  readonly path: string;
  readonly text: string;
}

export interface SkillFolder {
  readonly skill: Skill;
  readonly files: readonly SkillFile[];
}

export interface ReadSkills {
  readonly skills: readonly SkillFolder[];
  readonly problems: readonly ConfigurationProblem[];
}

export interface SkillReaderPort {
  read(files: readonly ConfigurationFile[]): ReadSkills;
}
