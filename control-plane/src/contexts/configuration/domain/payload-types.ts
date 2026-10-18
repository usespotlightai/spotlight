import { HarnessProfileCreated } from '@configuration/domain/events/harness-profile-created.event';
import { HarnessProfileDeleted } from '@configuration/domain/events/harness-profile-deleted.event';
import { HarnessProfileUpdated } from '@configuration/domain/events/harness-profile-updated.event';
import { SkillCreated } from '@configuration/domain/events/skill-created.event';
import { SkillDeleted } from '@configuration/domain/events/skill-deleted.event';
import { SkillUpdated } from '@configuration/domain/events/skill-updated.event';
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

export const CONFIGURATION_PAYLOAD_TYPES = [
  ConfigurationFile,
  SkillDefinitionId,
  SkillFiles,
  SkillKey,
  StationUses,
  ToolName,
  SkillCreated,
  SkillUpdated,
  SkillDeleted,
  HarnessProfileId,
  ProfileKey,
  McpServer,
  PermissionRule,
  ProfileSettings,
  HarnessProfileCreated,
  HarnessProfileUpdated,
  HarnessProfileDeleted,
] as const;
