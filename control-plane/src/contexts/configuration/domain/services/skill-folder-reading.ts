import type { Skill } from '@configuration/domain/value-objects/skill.vo';
import type { SkillFiles } from '@configuration/domain/value-objects/skill-files.vo';
import type { SkillKey } from '@configuration/domain/value-objects/skill-key.vo';

export interface SkillFolderReading {
  skillIn(key: SkillKey, files: SkillFiles): Skill;
}
