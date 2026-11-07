import type { ReadSkillFolder } from '@configuration/application/ports/skill-folders.port';
import type { SkillKey } from '@shared-kernel/domain/value-objects/skill-key.vo';

export interface BuiltInSkillsPort {
  named(key: SkillKey): ReadSkillFolder | null;
}
