import type { ReadySkillFolder } from '@work/application/dto/ready-skill.dto';

export const BUILT_IN_SKILLS = Symbol('BUILT_IN_SKILLS');

export const BUILT_IN_SKILL_KEYS = Symbol('BUILT_IN_SKILL_KEYS');

export interface BuiltInSkillsPort {
  named(key: string): ReadySkillFolder | null;
}
