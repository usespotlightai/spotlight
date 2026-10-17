import type { SkillFolder } from '@configuration/application/ports/skill-reader.port';

const _BUILT_IN_SKILLS = Symbol('BUILT_IN_SKILLS');

export interface BuiltInSkillsPort {
  named(key: string): SkillFolder | null;
}
