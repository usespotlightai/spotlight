import type { SkillFolder } from '@configuration/application/ports/skill-reader.port';

export const SHIPPED_SKILLS = Symbol('SHIPPED_SKILLS');

export interface ShippedSkillsPort {
  named(key: string): SkillFolder | null;
}
