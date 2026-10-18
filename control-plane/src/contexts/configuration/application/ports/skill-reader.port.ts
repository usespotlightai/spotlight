import type { Skill } from '@configuration/domain/entities/skill.entity';
import type { ConfigurationFile } from '@configuration/domain/value-objects/configuration-file.vo';
import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';

export interface SkillFile {
  readonly path: string;
  readonly text: string;
}

export const SKILL_READER = Symbol('SKILL_READER');

export interface SkillFolder {
  readonly skill: Skill;
  readonly files: readonly SkillFile[];
}

export interface ParsedSkills {
  readonly skills: readonly SkillFolder[];
  readonly problems: readonly ConfigurationProblem[];
}

export type SkillOrigin = 'defined' | 'built-in';

export interface SkillReaderPort {
  parse(files: readonly ConfigurationFile[]): ParsedSkills;

  folder(
    name: string,
    files: readonly SkillFile[],
    origin: SkillOrigin,
  ): SkillFolder;
}
