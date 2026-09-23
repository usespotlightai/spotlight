import { SkillDefined } from '@configuration/domain/events/skill-defined.event';
import { SkillRedefined } from '@configuration/domain/events/skill-redefined.event';
import { SkillRetired } from '@configuration/domain/events/skill-retired.event';
import { SkillDefinitionId } from '@configuration/domain/value-objects/skill-definition-id.vo';
import { SkillFiles } from '@configuration/domain/value-objects/skill-files.vo';
import { SkillKey } from '@configuration/domain/value-objects/skill-key.vo';
import { SkillUses } from '@configuration/domain/value-objects/skill-uses.vo';
import { ToolName } from '@configuration/domain/value-objects/tool-name.vo';

export const CONFIGURATION_EVENT_TYPES = [
  SkillDefinitionId,
  SkillFiles,
  SkillKey,
  SkillUses,
  ToolName,
  SkillDefined,
  SkillRedefined,
  SkillRetired,
] as const;
