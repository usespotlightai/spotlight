import type { SkillFolder } from '@configuration/application/ports/skill-reader.port';

const _SHIPPED_SKILLS = Symbol('SHIPPED_SKILLS');

export interface ShippedSkillsPort {
  named(key: string): SkillFolder | null;
}
