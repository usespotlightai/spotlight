import { HarnessProfileCreated } from '@configuration/domain/events/harness-profile-created.event';
import { HarnessProfileDeleted } from '@configuration/domain/events/harness-profile-deleted.event';
import { HarnessProfileUpdated } from '@configuration/domain/events/harness-profile-updated.event';
import { SkillCreated } from '@configuration/domain/events/skill-created.event';
import { SkillDeleted } from '@configuration/domain/events/skill-deleted.event';
import { SkillUpdated } from '@configuration/domain/events/skill-updated.event';
import { TerraformStateDeleted } from '@configuration/domain/events/terraform-state-deleted.event';
import { TerraformStateLockReleased } from '@configuration/domain/events/terraform-state-lock-released.event';
import { TerraformStateWritten } from '@configuration/domain/events/terraform-state-written.event';
import { DefinedSkillKey } from '@configuration/domain/value-objects/defined-skill-key.vo';
import { HarnessCompatibility } from '@configuration/domain/value-objects/harness-compatibility.vo';
import { HarnessProfileId } from '@configuration/domain/value-objects/harness-profile-id.vo';
import { McpServer } from '@configuration/domain/value-objects/mcp-server.vo';
import { PermissionRule } from '@configuration/domain/value-objects/permission-rule.vo';
import { PrincipalRef } from '@configuration/domain/value-objects/principal-ref.vo';
import { ProfileSettings } from '@configuration/domain/value-objects/profile-settings.vo';
import { SecretReference } from '@configuration/domain/value-objects/secret-reference.vo';
import { SkillDefinitionId } from '@configuration/domain/value-objects/skill-definition-id.vo';
import { SkillFiles } from '@configuration/domain/value-objects/skill-files.vo';
import { Skill } from '@configuration/domain/value-objects/skill.vo';
import { StateChangeDetail } from '@configuration/domain/value-objects/state-change-detail.vo';
import { StateLockId } from '@configuration/domain/value-objects/state-lock-id.vo';
import { StateLock } from '@configuration/domain/value-objects/state-lock.vo';
import { StateName } from '@configuration/domain/value-objects/state-name.vo';
import { StateSnapshot } from '@configuration/domain/value-objects/state-snapshot.vo';
import { StateVersionId } from '@configuration/domain/value-objects/state-version-id.vo';
import { StateVersion } from '@configuration/domain/value-objects/state-version.vo';
import { StationUses } from '@configuration/domain/value-objects/station-uses.vo';
import { TerraformStateId } from '@configuration/domain/value-objects/terraform-state-id.vo';

export const CONFIGURATION_PAYLOAD_TYPES = [
  Skill,
  SkillDefinitionId,
  SkillFiles,
  DefinedSkillKey,
  StationUses,
  SkillCreated,
  SkillUpdated,
  SkillDeleted,
  HarnessProfileId,
  HarnessCompatibility,
  McpServer,
  PermissionRule,
  ProfileSettings,
  SecretReference,
  HarnessProfileCreated,
  HarnessProfileUpdated,
  HarnessProfileDeleted,
  TerraformStateId,
  StateName,
  StateLock,
  StateLockId,
  PrincipalRef,
  StateSnapshot,
  StateVersion,
  StateVersionId,
  StateChangeDetail,
  TerraformStateWritten,
  TerraformStateLockReleased,
  TerraformStateDeleted,
] as const;
