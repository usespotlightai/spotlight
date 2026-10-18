import { ConnectionRefreshFailed } from '@integrations/domain/events/connection-refresh-failed.event';
import { HookCreated } from '@integrations/domain/events/hook-created.event';
import { HookDeleted } from '@integrations/domain/events/hook-deleted.event';
import { HookDeletionRequested } from '@integrations/domain/events/hook-deletion-requested.event';
import { HookUpdated } from '@integrations/domain/events/hook-updated.event';
import { IntegrationConnected } from '@integrations/domain/events/integration-connected.event';
import { IntegrationCreated } from '@integrations/domain/events/integration-created.event';
import { IntegrationDeleted } from '@integrations/domain/events/integration-deleted.event';
import { IntegrationDeletionRequested } from '@integrations/domain/events/integration-deletion-requested.event';
import { IntegrationDisconnected } from '@integrations/domain/events/integration-disconnected.event';
import { IntegrationSpecRefreshed } from '@integrations/domain/events/integration-spec-refreshed.event';
import { IntegrationUpdated } from '@integrations/domain/events/integration-updated.event';
import { ActsAs } from '@integrations/domain/value-objects/acts-as.vo';
import { ApiSpec } from '@integrations/domain/value-objects/api-spec.vo';
import { ApprovalNeeded } from '@integrations/domain/value-objects/approval-needed.vo';
import { AuthorizationServer } from '@integrations/domain/value-objects/authorization-server.vo';
import { Binding } from '@integrations/domain/value-objects/binding.vo';
import { CallbackNote } from '@integrations/domain/value-objects/callback-note.vo';
import { ConnectionMissing } from '@integrations/domain/value-objects/connection-missing.vo';
import { ConnectionOwner } from '@integrations/domain/value-objects/connection-owner.vo';
import { ContentHash } from '@integrations/domain/value-objects/content-hash.vo';
import { CronExpression } from '@integrations/domain/value-objects/cron-expression.vo';
import { DeclaredHappening } from '@integrations/domain/value-objects/declared-happening.vo';
import { DefinedActions } from '@integrations/domain/value-objects/defined-actions.vo';
import { DefinitionDocument } from '@integrations/domain/value-objects/definition-document.vo';
import { HappeningName } from '@integrations/domain/value-objects/happening-name.vo';
import { HookAddress } from '@integrations/domain/value-objects/hook-address.vo';
import { HookDecision } from '@integrations/domain/value-objects/hook-decision.vo';
import { HookDefinitionId } from '@integrations/domain/value-objects/hook-definition-id.vo';
import { HookEvent } from '@integrations/domain/value-objects/hook-event.vo';
import { HookFailure } from '@integrations/domain/value-objects/hook-failure.vo';
import { HookKey } from '@integrations/domain/value-objects/hook-key.vo';
import { HookReply } from '@integrations/domain/value-objects/hook-reply.vo';
import { IntegrationAddress } from '@integrations/domain/value-objects/integration-address.vo';
import { IntegrationDefinitionId } from '@integrations/domain/value-objects/integration-definition-id.vo';
import { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import { MarkKind } from '@integrations/domain/value-objects/mark-kind.vo';
import { Opening } from '@integrations/domain/value-objects/opening.vo';
import { OperationFilter } from '@integrations/domain/value-objects/operation-filter.vo';
import { OutputShape } from '@integrations/domain/value-objects/output-shape.vo';
import { PersonToolRule } from '@integrations/domain/value-objects/person-tool-rule.vo';
import { Poll } from '@integrations/domain/value-objects/poll.vo';
import { ProvidedTool } from '@integrations/domain/value-objects/provided-tool.vo';
import { RefreshClaim } from '@integrations/domain/value-objects/refresh-claim.vo';
import { Schedule } from '@integrations/domain/value-objects/schedule.vo';
import { SpecFetchResult } from '@integrations/domain/value-objects/spec-fetch-result.vo';
import { SpecOperation } from '@integrations/domain/value-objects/spec-operation.vo';
import { SpecRefreshDetail } from '@integrations/domain/value-objects/spec-refresh-detail.vo';
import { ToolBacking } from '@integrations/domain/value-objects/tool-backing.vo';
import { ToolName } from '@integrations/domain/value-objects/tool-name.vo';
import { ToolUses } from '@integrations/domain/value-objects/tool-uses.vo';
import { Webhook } from '@integrations/domain/value-objects/webhook.vo';

export const INTEGRATIONS_PAYLOAD_TYPES = [
  HookFailure,
  ApprovalNeeded,
  AuthorizationServer,
  Binding,
  CallbackNote,
  ConnectionOwner,
  ActsAs,
  ConnectionMissing,
  ContentHash,
  CronExpression,
  DeclaredHappening,
  DefinedActions,
  DefinitionDocument,
  SpecOperation,
  ApiSpec,
  HappeningName,
  HookAddress,
  HookDefinitionId,
  HookEvent,
  HookKey,
  HookReply,
  HookDecision,
  IntegrationAddress,
  IntegrationDefinitionId,
  MarkKind,
  ProvidedTool,
  OperationFilter,
  Opening,
  OutputShape,
  PersonToolRule,
  Poll,
  RefreshClaim,
  Schedule,
  SpecRefreshDetail,
  IntegrationKey,
  SpecFetchResult,
  ToolBacking,
  ToolName,
  ToolUses,
  Webhook,
  HookDeletionRequested,
  HookCreated,
  HookUpdated,
  HookDeleted,
  IntegrationConnected,
  IntegrationDisconnected,
  ConnectionRefreshFailed,
  IntegrationDeletionRequested,
  IntegrationCreated,
  IntegrationUpdated,
  IntegrationSpecRefreshed,
  IntegrationDeleted,
] as const;
