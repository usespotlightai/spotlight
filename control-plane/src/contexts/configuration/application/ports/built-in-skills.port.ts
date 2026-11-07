import type { ReadSkillFolder } from '@configuration/application/ports/skill-folders.port';

export interface BuiltInSkillsPort {
  named(key: string): ReadSkillFolder | null;
}
