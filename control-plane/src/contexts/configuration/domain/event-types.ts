import { SkillKey } from '@configuration/domain/value-objects/skill-key.vo';
import { ToolName } from '@configuration/domain/value-objects/tool-name.vo';

export const CONFIGURATION_EVENT_TYPES = [SkillKey, ToolName] as const;
