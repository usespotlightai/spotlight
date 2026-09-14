import type { SkillFolder } from '@application/ports/skill-reader.port';
import type { SkillKey } from '@domain/value-objects/skill-key.vo';

export const BUILT_IN_SKILLS = Symbol('BUILT_IN_SKILLS');

export interface BuiltInSkillsPort {
  named(key: SkillKey): SkillFolder | null;
}
