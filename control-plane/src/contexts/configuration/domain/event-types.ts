import { HarnessProfileDefined } from '@configuration/domain/events/harness-profile-defined.event';
import { HarnessProfileRedefined } from '@configuration/domain/events/harness-profile-redefined.event';
import { HarnessProfileRetired } from '@configuration/domain/events/harness-profile-retired.event';
import { SkillDefined } from '@configuration/domain/events/skill-defined.event';
import { SkillRedefined } from '@configuration/domain/events/skill-redefined.event';
import { SkillRetired } from '@configuration/domain/events/skill-retired.event';
import { ConfigurationFile } from '@configuration/domain/value-objects/configuration-file.vo';
import { HarnessProfileId } from '@configuration/domain/value-objects/harness-profile-id.vo';
import { McpServer } from '@configuration/domain/value-objects/mcp-server.vo';
import { PermissionRule } from '@configuration/domain/value-objects/permission-rule.vo';
import { ProfileKey } from '@configuration/domain/value-objects/profile-key.vo';
import { ProfileSettings } from '@configuration/domain/value-objects/profile-settings.vo';
import { SkillDefinitionId } from '@configuration/domain/value-objects/skill-definition-id.vo';
import { SkillFiles } from '@configuration/domain/value-objects/skill-files.vo';
import { SkillKey } from '@configuration/domain/value-objects/skill-key.vo';
import { StationUses } from '@configuration/domain/value-objects/station-uses.vo';
import { ToolName } from '@configuration/domain/value-objects/tool-name.vo';

export const CONFIGURATION_EVENT_TYPES = [
  ConfigurationFile,
  SkillDefinitionId,
  SkillFiles,
  SkillKey,
  StationUses,
  ToolName,
  SkillDefined,
  SkillRedefined,
  SkillRetired,
  HarnessProfileId,
  ProfileKey,
  McpServer,
  PermissionRule,
  ProfileSettings,
  HarnessProfileDefined,
  HarnessProfileRedefined,
  HarnessProfileRetired,
] as const;
