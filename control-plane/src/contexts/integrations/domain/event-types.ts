import { HostConnected } from '@integrations/domain/events/host-connected.event';
import { HostRenewalRefused } from '@integrations/domain/events/host-renewal-refused.event';
import { IntegrationDefined } from '@integrations/domain/events/integration-defined.event';
import { IntegrationRedefined } from '@integrations/domain/events/integration-redefined.event';
import { IntegrationRetired } from '@integrations/domain/events/integration-retired.event';
import { ApprovalNeeded } from '@integrations/domain/value-objects/approval-needed.vo';
import { Binding } from '@integrations/domain/value-objects/binding.vo';
import { CronExpression } from '@integrations/domain/value-objects/cron-expression.vo';
import { DeclaredHappening } from '@integrations/domain/value-objects/declared-happening.vo';
import { DefinedActions } from '@integrations/domain/value-objects/defined-actions.vo';
import { HappeningName } from '@integrations/domain/value-objects/happening-name.vo';
import { IntegrationAddress } from '@integrations/domain/value-objects/integration-address.vo';
import { IntegrationDefinitionId } from '@integrations/domain/value-objects/integration-definition-id.vo';
import { MarkKind } from '@integrations/domain/value-objects/mark-kind.vo';
import { OfferedTool } from '@integrations/domain/value-objects/offered-tool.vo';
import { Opening } from '@integrations/domain/value-objects/opening.vo';
import { Poll } from '@integrations/domain/value-objects/poll.vo';
import { Schedule } from '@integrations/domain/value-objects/schedule.vo';
import { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import { ToolUses } from '@integrations/domain/value-objects/tool-uses.vo';
import { Webhook } from '@integrations/domain/value-objects/webhook.vo';

export const INTEGRATIONS_EVENT_TYPES = [
  ApprovalNeeded,
  Binding,
  CronExpression,
  DeclaredHappening,
  DefinedActions,
  HappeningName,
  IntegrationAddress,
  IntegrationDefinitionId,
  MarkKind,
  OfferedTool,
  Opening,
  Poll,
  Schedule,
  SourceKey,
  ToolUses,
  Webhook,
  HostConnected,
  HostRenewalRefused,
  IntegrationDefined,
  IntegrationRedefined,
  IntegrationRetired,
] as const;
