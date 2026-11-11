import type { DefinedSkillKey } from '@configuration/domain/value-objects/defined-skill-key.vo';
import type { SkillFiles } from '@configuration/domain/value-objects/skill-files.vo';
import type { Skill } from '@configuration/domain/value-objects/skill.vo';

export interface SkillFolderReading {
  skillIn(key: DefinedSkillKey, files: SkillFiles): Skill;
}
