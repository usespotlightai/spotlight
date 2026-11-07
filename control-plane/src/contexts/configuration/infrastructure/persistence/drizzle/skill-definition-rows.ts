import type { SkillFolder } from '@configuration/domain/aggregates/skill-definition.aggregate';
import { SkillFiles } from '@configuration/domain/value-objects/skill-files.vo';
import { SkillKey } from '@configuration/domain/value-objects/skill-key.vo';
import type { skillDefinition } from '@configuration/infrastructure/persistence/drizzle/schemas/configuration.schema';

type Row = typeof skillDefinition.$inferSelect;

export const storedSkillOf = (row: Row): SkillFolder => ({
  key: SkillKey.of(row.key),
  files: SkillFiles.of(row.files),
});
