import { ConfigurationMoveStarted } from '@configuration/domain/events/configuration-move-started.event';
import { ConfigurationMoved } from '@configuration/domain/events/configuration-moved.event';
import { ConfigurationPinned } from '@configuration/domain/events/configuration-pinned.event';
import { ConfigurationRead } from '@configuration/domain/events/configuration-read.event';
import { Commit } from '@configuration/domain/value-objects/commit.vo';
import { ConfiguredIntegration } from '@configuration/domain/value-objects/configured-integration.vo';
import { SealedVault } from '@configuration/domain/value-objects/sealed-vault.vo';
import { SkillKey } from '@configuration/domain/value-objects/skill-key.vo';
import { ToolName } from '@configuration/domain/value-objects/tool-name.vo';

export const CONFIGURATION_EVENT_TYPES = [
  Commit,
  ConfiguredIntegration,
  SealedVault,
  SkillKey,
  ToolName,
  ConfigurationMoveStarted,
  ConfigurationMoved,
  ConfigurationPinned,
  ConfigurationRead,
] as const;
