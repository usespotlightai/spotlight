import type { SkillFolder } from '@configuration/domain/aggregates/skill-definition.aggregate';
import { DefinedSkillKey } from '@configuration/domain/value-objects/defined-skill-key.vo';
import { SkillFiles } from '@configuration/domain/value-objects/skill-files.vo';
import type { skillDefinition } from '@configuration/infrastructure/persistence/drizzle/schemas/configuration.schema';

type Row = typeof skillDefinition.$inferSelect;

export const storedSkillOf = (row: Row): SkillFolder => ({
  key: DefinedSkillKey.of(row.key),
  files: SkillFiles.of(row.files),
});
