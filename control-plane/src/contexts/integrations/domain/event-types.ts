import { HookAbandonmentDue } from '@integrations/domain/events/hook-abandonment-due.event';
import { HookDefined } from '@integrations/domain/events/hook-defined.event';
import { HookRedefined } from '@integrations/domain/events/hook-redefined.event';
import { HookRetired } from '@integrations/domain/events/hook-retired.event';
import { HostConnected } from '@integrations/domain/events/host-connected.event';
import { HostDisconnected } from '@integrations/domain/events/host-disconnected.event';
import { HostRenewalRefused } from '@integrations/domain/events/host-renewal-refused.event';
import { IntegrationAbandonmentDue } from '@integrations/domain/events/integration-abandonment-due.event';
import { IntegrationDefined } from '@integrations/domain/events/integration-defined.event';
import { IntegrationRedefined } from '@integrations/domain/events/integration-redefined.event';
import { IntegrationReread } from '@integrations/domain/events/integration-reread.event';
import { IntegrationRetired } from '@integrations/domain/events/integration-retired.event';
import { ApprovalNeeded } from '@integrations/domain/value-objects/approval-needed.vo';
import { AuthorizationServer } from '@integrations/domain/value-objects/authorization-server.vo';
import { Binding } from '@integrations/domain/value-objects/binding.vo';
import { CallbackNote } from '@integrations/domain/value-objects/callback-note.vo';
import { ConnectionHolder } from '@integrations/domain/value-objects/connection-holder.vo';
import { ConnectionHolding } from '@integrations/domain/value-objects/connection-holding.vo';
import { ConnectionWanted } from '@integrations/domain/value-objects/connection-wanted.vo';
import { ContentHash } from '@integrations/domain/value-objects/content-hash.vo';
import { CronExpression } from '@integrations/domain/value-objects/cron-expression.vo';
import { DeclaredHappening } from '@integrations/domain/value-objects/declared-happening.vo';
import { DefinedActions } from '@integrations/domain/value-objects/defined-actions.vo';
import { DefinitionDocument } from '@integrations/domain/value-objects/definition-document.vo';
import { DescribedOperation } from '@integrations/domain/value-objects/described-operation.vo';
import { DescribedSource } from '@integrations/domain/value-objects/described-source.vo';
import { HappeningName } from '@integrations/domain/value-objects/happening-name.vo';
import { HookAddress } from '@integrations/domain/value-objects/hook-address.vo';
import { HookDefinitionId } from '@integrations/domain/value-objects/hook-definition-id.vo';
import { HookEvent } from '@integrations/domain/value-objects/hook-event.vo';
import { HookFailure } from '@integrations/domain/value-objects/hook-failure.vo';
import { HookKey } from '@integrations/domain/value-objects/hook-key.vo';
import { HookReply } from '@integrations/domain/value-objects/hook-reply.vo';
import { HookVerdict } from '@integrations/domain/value-objects/hook-verdict.vo';
import { IntegrationAddress } from '@integrations/domain/value-objects/integration-address.vo';
import { IntegrationDefinitionId } from '@integrations/domain/value-objects/integration-definition-id.vo';
import { MarkKind } from '@integrations/domain/value-objects/mark-kind.vo';
import { OfferedTool } from '@integrations/domain/value-objects/offered-tool.vo';
import { Opening } from '@integrations/domain/value-objects/opening.vo';
import { OperationFilter } from '@integrations/domain/value-objects/operation-filter.vo';
import { OutputShape } from '@integrations/domain/value-objects/output-shape.vo';
import { PersonToolRule } from '@integrations/domain/value-objects/person-tool-rule.vo';
import { Poll } from '@integrations/domain/value-objects/poll.vo';
import { RenewalClaim } from '@integrations/domain/value-objects/renewal-claim.vo';
import { RereadDetail } from '@integrations/domain/value-objects/reread-detail.vo';
import { Schedule } from '@integrations/domain/value-objects/schedule.vo';
import { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import { SourceReading } from '@integrations/domain/value-objects/source-reading.vo';
import { ToolBacking } from '@integrations/domain/value-objects/tool-backing.vo';
import { ToolName } from '@integrations/domain/value-objects/tool-name.vo';
import { ToolUses } from '@integrations/domain/value-objects/tool-uses.vo';
import { Webhook } from '@integrations/domain/value-objects/webhook.vo';

export const INTEGRATIONS_EVENT_TYPES = [
  HookFailure,
  ApprovalNeeded,
  AuthorizationServer,
  Binding,
  CallbackNote,
  ConnectionHolder,
  ConnectionHolding,
  ConnectionWanted,
  ContentHash,
  CronExpression,
  DeclaredHappening,
  DefinedActions,
  DefinitionDocument,
  DescribedOperation,
  DescribedSource,
  HappeningName,
  HookAddress,
  HookDefinitionId,
  HookEvent,
  HookKey,
  HookReply,
  HookVerdict,
  IntegrationAddress,
  IntegrationDefinitionId,
  MarkKind,
  OfferedTool,
  OperationFilter,
  Opening,
  OutputShape,
  PersonToolRule,
  Poll,
  RenewalClaim,
  Schedule,
  RereadDetail,
  SourceKey,
  SourceReading,
  ToolBacking,
  ToolName,
  ToolUses,
  Webhook,
  HookAbandonmentDue,
  HookDefined,
  HookRedefined,
  HookRetired,
  HostConnected,
  HostDisconnected,
  HostRenewalRefused,
  IntegrationAbandonmentDue,
  IntegrationDefined,
  IntegrationRedefined,
  IntegrationReread,
  IntegrationRetired,
] as const;
