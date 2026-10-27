import {
  CATALOG,
  type CatalogPort,
} from '@catalog/application/ports/catalog.port';
import {
  INSTALLATION_REPOSITORIES,
  type InstallationRepositoriesPort,
} from '@github/application/ports/installation-repositories.port';
import {
  PULL_REQUESTS,
  type PullRequestPort,
} from '@github/application/ports/pull-request.port';
import {
  REPOSITORY_GIT,
  type RepositoryGitPort,
} from '@github/application/ports/repository-git.port';
import {
  REPOSITORY_SETTINGS,
  type RepositorySettingsPort,
} from '@github/application/ports/repository-settings.port';
import { REVIEW_COMMENTS } from '@github/application/ports/review-comments.port';
import {
  WORKSPACE_CONNECTIONS,
  type WorkspaceConnectionsPort,
} from '@github/application/ports/workspace-connections.port';
import {
  GITHUB_ACTIONS_TRUSTS,
  type GitHubActionsTrustsPort,
} from '@identity/application/ports/github-actions-trusts.port';
import {
  MEMBER_DIRECTORY,
  type MemberDirectoryPort,
} from '@identity/application/ports/member-directory.port';
import {
  RUN_TOKENS,
  type RunTokensPort,
} from '@identity/application/ports/run-tokens.port';
import {
  TEAM_DEPENDENTS,
  type TeamDependentsPort,
} from '@identity/application/ports/team-dependents.port';
import {
  TEAM_DIRECTORY,
  type TeamDirectoryPort,
} from '@identity/application/ports/team-directory.port';
import {
  WORKSPACE_ACCESS,
  type WorkspaceAccessPort,
} from '@identity/application/ports/workspace-access.port';
import {
  WORKSPACE_READER,
  type WorkspaceReaderPort,
} from '@identity/application/ports/workspace-reader.port';
import type { Provider, Type } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ENV } from '@platform/config/config.constants';
import { publicUrlOf } from '@platform/config/env';
import type { Env } from '@platform/config/env.schema';
import { bindCommandHandler } from '@platform/cqrs/bind-command-handler';
import { bindQueryHandler } from '@platform/cqrs/bind-query-handler';
import { EventSubscribers } from '@platform/events/event-subscribers';
import { IntegrationEventMappers } from '@platform/events/integration-event-mappers';
import { PayloadTypes } from '@platform/events/payload-types';
import { ReadinessChecks } from '@platform/health/readiness-checks';
import { AuthenticatedGuard } from '@platform/http/guards/authenticated.guard';
import { RunnerGuard } from '@platform/http/guards/runner.guard';
import { CryptoIdGenerator } from '@platform/ids/crypto-id.generator';
import { s3ClientsOf } from '@platform/storage/s3-clients';
import { RUNNER_AUTHENTICATOR } from '@runners/application/ports/runner-authenticator.port';
import { RUNNER_EGRESS } from '@runners/application/ports/runner-egress.port';
import { RUNNER_HEARTBEATS } from '@runners/application/ports/runner-heartbeats.port';
import {
  RUNNER_POOLS,
  type RunnerPoolsPort,
} from '@runners/application/ports/runner-pools.port';
import {
  RUNNER_READER,
  type RunnerReaderPort,
} from '@runners/application/ports/runner-reader.port';
import {
  RUNNERS,
  type RunnersPort,
} from '@runners/application/ports/runners.port';
import {
  RUN_GRANTS,
  type RunGrantsPort,
} from '@secrets/application/ports/run-grants.port';
import {
  RUN_SECRET_FETCHES,
  type RunSecretFetchesPort,
} from '@secrets/application/ports/run-secret-fetches.port';
import {
  CLOCK,
  type ClockPort,
} from '@shared-kernel/application/ports/clock.port';
import { DOMAIN_EVENT_DISPATCHER } from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import {
  ID_GENERATOR,
  type IdGeneratorPort,
} from '@shared-kernel/application/ports/id-generator.port';
import { IDEMPOTENT_CREATES } from '@shared-kernel/application/ports/idempotent-creates.port';
import {
  LOGGER,
  type LoggerPort,
} from '@shared-kernel/application/ports/logger.port';
import {
  SAVEPOINT,
  type SavepointPort,
} from '@shared-kernel/application/ports/savepoint.port';
import {
  TELEMETRY,
  type TelemetryPort,
} from '@shared-kernel/application/ports/telemetry.port';
import {
  TRANSACTION,
  type TransactionPort,
} from '@shared-kernel/application/ports/transaction.port';
import { AckMessagesCommand } from '@work/application/commands/ack-messages.command';
import { AddTaskCommand } from '@work/application/commands/add-task.command';
import { AnswerInboxItemCommand } from '@work/application/commands/answer-inbox-item.command';
import { AskPermissionCommand } from '@work/application/commands/ask-permission.command';
import { AssignTaskCommand } from '@work/application/commands/assign-task.command';
import {
  AcceptProposalCommand,
  DismissProposalCommand,
  SendChatMessageCommand,
  StartChatCommand,
  StopChatCommand,
} from '@work/application/commands/chat.commands';
import { CreateLineCommand } from '@work/application/commands/create-line.command';
import { DeleteLineCommand } from '@work/application/commands/delete-line.command';
import { DeleteTaskCommand } from '@work/application/commands/delete-task.command';
import {
  AuthorizeRunnerCommand,
  CheckActiveRunsCommand,
  FetchRunSecretsCommand,
  FetchSharedRunSecretsCommand,
  RecordEgressConnectionsCommand,
} from '@work/application/commands/egress.commands';
import { GrantAttachmentUploadCommand } from '@work/application/commands/grant-attachment-upload.command';
import { AcceptProposalHandler } from '@work/application/commands/handlers/accept-proposal.handler';
import { AckMessagesHandler } from '@work/application/commands/handlers/ack-messages.handler';
import { AddTaskHandler } from '@work/application/commands/handlers/add-task.handler';
import { AnswerInboxItemHandler } from '@work/application/commands/handlers/answer-inbox-item.handler';
import { AppendRunJournalHandler } from '@work/application/commands/handlers/append-run-journal.handler';
import { AskPermissionHandler } from '@work/application/commands/handlers/ask-permission.handler';
import { AssignTaskHandler } from '@work/application/commands/handlers/assign-task.handler';
import { AuthorizeRunnerHandler } from '@work/application/commands/handlers/authorize-runner.handler';
import { CheckActiveRunsHandler } from '@work/application/commands/handlers/check-active-runs.handler';
import { ClaimHostCallHandler } from '@work/application/commands/handlers/claim-host-call.handler';
import { ClaimHostWorkHandler } from '@work/application/commands/handlers/claim-host-work.handler';
import { ClaimRunHandler } from '@work/application/commands/handlers/claim-run.handler';
import { CompleteRunHandler } from '@work/application/commands/handlers/complete-run.handler';
import { CompleteWorkspaceArchiveHandler } from '@work/application/commands/handlers/complete-workspace-archive.handler';
import { CreateLineHandler } from '@work/application/commands/handlers/create-line.handler';
import { DeleteLineHandler } from '@work/application/commands/handlers/delete-line.handler';
import { DeleteTaskHandler } from '@work/application/commands/handlers/delete-task.handler';
import { DismissProposalHandler } from '@work/application/commands/handlers/dismiss-proposal.handler';
import { EnqueueRunHandler } from '@work/application/commands/handlers/enqueue-run.handler';
import { FetchRunSecretsHandler } from '@work/application/commands/handlers/fetch-run-secrets.handler';
import { FetchSharedRunSecretsHandler } from '@work/application/commands/handlers/fetch-shared-run-secrets.handler';
import { GrantAttachmentUploadHandler } from '@work/application/commands/handlers/grant-attachment-upload.handler';
import { GrantWorkspaceArchiveHandler } from '@work/application/commands/handlers/grant-workspace-archive.handler';
import { KeepTaskDraftHandler } from '@work/application/commands/handlers/keep-task-draft.handler';
import { MarkInboxItemReadHandler } from '@work/application/commands/handlers/mark-inbox-item-read.handler';
import { MarkInboxRequestReadHandler } from '@work/application/commands/handlers/mark-inbox-request-read.handler';
import { MoveTaskHandler } from '@work/application/commands/handlers/move-task.handler';
import { RecordEgressConnectionsHandler } from '@work/application/commands/handlers/record-egress-connections.handler';
import { RecordHostCallResponseHandler } from '@work/application/commands/handlers/record-host-call-response.handler';
import { RecordRunImageHandler } from '@work/application/commands/handlers/record-run-image.handler';
import { RecordStartingPointHandler } from '@work/application/commands/handlers/record-starting-point.handler';
import { RenewCheckLeaseHandler } from '@work/application/commands/handlers/renew-check-lease.handler';
import { RenewLeaseHandler } from '@work/application/commands/handlers/renew-lease.handler';
import { ReplyToReviewCommentHandler } from '@work/application/commands/handlers/reply-to-review-comment.handler';
import { ResolveNoticeHandler } from '@work/application/commands/handlers/resolve-notice.handler';
import { SendChatMessageHandler } from '@work/application/commands/handlers/send-chat-message.handler';
import { SendMessageHandler } from '@work/application/commands/handlers/send-message.handler';
import { StartChatHandler } from '@work/application/commands/handlers/start-chat.handler';
import { StopChatHandler } from '@work/application/commands/handlers/stop-chat.handler';
import { StopRunHandler } from '@work/application/commands/handlers/stop-run.handler';
import { SuspendRunHandler } from '@work/application/commands/handlers/suspend-run.handler';
import { UpdateLineHandler } from '@work/application/commands/handlers/update-line.handler';
import { UseToolHandler } from '@work/application/commands/handlers/use-tool.handler';
import {
  ClaimHostCallCommand,
  RecordHostCallResponseCommand,
} from '@work/application/commands/host-call.commands';
import { KeepTaskDraftCommand } from '@work/application/commands/keep-task-draft.command';
import { MarkInboxItemReadCommand } from '@work/application/commands/mark-inbox-item-read.command';
import { MarkInboxRequestReadCommand } from '@work/application/commands/mark-inbox-request-read.command';
import { MoveTaskCommand } from '@work/application/commands/move-task.command';
import { ReplyToReviewCommentCommand } from '@work/application/commands/reply-to-review-comment.command';
import { ResolveNoticeCommand } from '@work/application/commands/resolve-notice.command';
import {
  AppendRunJournalCommand,
  ClaimHostWorkCommand,
  ClaimRunCommand,
  CompleteRunCommand,
  EnqueueRunCommand,
  RecordRunImageCommand,
  RecordStartingPointCommand,
  RenewCheckLeaseCommand,
  RenewLeaseCommand,
  SuspendRunCommand,
} from '@work/application/commands/runner.commands';
import { SendMessageCommand } from '@work/application/commands/send-message.command';
import { StopRunCommand } from '@work/application/commands/stop-run.command';
import { UpdateLineCommand } from '@work/application/commands/update-line.command';
import { UseToolCommand } from '@work/application/commands/use-tool.command';
import {
  CompleteWorkspaceArchiveCommand,
  GrantWorkspaceArchiveCommand,
} from '@work/application/commands/workspace-archive.commands';
import { CancelDetachedRun } from '@work/application/events/handlers/cancel-detached-run.handler';
import { ChatOutcomes } from '@work/application/events/handlers/chat-outcomes.handler';
import { CreateTaskFromProposal } from '@work/application/events/handlers/create-task-from-proposal.handler';
import { DeleteTeamLines } from '@work/application/events/handlers/delete-team-lines.handler';
import { EnqueueChatRun } from '@work/application/events/handlers/enqueue-chat-run.handler';
import { EnqueueTaskRun } from '@work/application/events/handlers/enqueue-task-run.handler';
import { HandOver } from '@work/application/events/handlers/hand-over.handler';
import { NotifyOutsideTools } from '@work/application/events/handlers/notify-outside-tools.handler';
import { RecordRunUsage } from '@work/application/events/handlers/record-run-usage.handler';
import { SeedTeam } from '@work/application/events/handlers/seed-team.handler';
import { WORK_EVENT_MAPPERS } from '@work/application/integration-events/work.event-mappers';
import { ACCESSIBLE_REPOSITORIES } from '@work/application/ports/accessible-repositories.port';
import type { ArchiveReferencesPort } from '@work/application/ports/archive-references.port';
import { ARCHIVE_REFERENCES } from '@work/application/ports/archive-references.port';
import { ATTACHMENT_READER } from '@work/application/ports/attachment-reader.port';
import {
  ATTACHMENT_STORE,
  type AttachmentStorePort,
} from '@work/application/ports/attachment-store.port';
import {
  BRIEFED_TASKS,
  type BriefedTasksPort,
} from '@work/application/ports/briefed-tasks.port';
import {
  BUILT_IN_SKILL_KEYS,
  BUILT_IN_SKILLS,
  type BuiltInSkillsPort,
} from '@work/application/ports/built-in-skills.port';
import {
  CHAT_READER,
  type ChatReaderPort,
} from '@work/application/ports/chat-reader.port';
import {
  CHECK_ACCESS,
  type CheckAccessPort,
} from '@work/application/ports/check-access.port';
import { CHECK_ENDINGS } from '@work/application/ports/check-endings.port';
import {
  CHECK_PROVISIONING,
  type CheckProvisioningPort,
} from '@work/application/ports/check-provisioning.port';
import {
  CHECK_WORK,
  type CheckWorkPort,
} from '@work/application/ports/check-work.port';
import {
  CONTENT_HASH,
  type ContentHashPort,
} from '@work/application/ports/content-hash.port';
import {
  CONTROL_PLANE_RELEASE,
  type ControlPlaneReleasePort,
} from '@work/application/ports/control-plane-release.port';
import { ENABLED_AT_STATIONS } from '@work/application/ports/enabled-at-stations.port';
import { GIT_GATEWAY } from '@work/application/ports/git-gateway.port';
import { HAPPENING_REACTIONS } from '@work/application/ports/happening-reactions.port';
import {
  HARNESS_LAUNCH,
  type HarnessLaunchPort,
} from '@work/application/ports/harness-launch.port';
import { HARNESS_PROFILE_REVIEW } from '@work/application/ports/harness-profile-review.port';
import { HARNESS_TOOL_NAMES } from '@work/application/ports/harness-tool-names.port';
import { HOOK_TRACES } from '@work/application/ports/hook-traces.port';
import { INBOX_READER } from '@work/application/ports/inbox-reader.port';
import { INBOX_REQUESTS } from '@work/application/ports/inbox-requests.port';
import {
  INTEGRATION_TOOL_CALLS,
  type IntegrationToolCallsPort,
} from '@work/application/ports/integration-tool-calls.port';
import {
  INTEGRATION_TOOLS,
  type IntegrationToolsPort,
} from '@work/application/ports/integration-tools.port';
import { LEASED_RUN_READER } from '@work/application/ports/leased-run-reader.port';
import {
  LIFECYCLE_HOOKS,
  type LifecycleHooksPort,
} from '@work/application/ports/lifecycle-hooks.port';
import {
  LINE_COMPILER,
  type LineCompilerPort,
} from '@work/application/ports/line-compiler.port';
import { LINE_IMAGES } from '@work/application/ports/line-images.port';
import { LINE_READER } from '@work/application/ports/line-reader.port';
import {
  LINE_RENDERING,
  type LineRenderingPort,
} from '@work/application/ports/line-rendering.port';
import type { LineResourcesPort } from '@work/application/ports/line-resources.port';
import { LINE_RESOURCES } from '@work/application/ports/line-resources.port';
import {
  LIVE_TASK_DRAFTS,
  type LiveTaskDraftsPort,
} from '@work/application/ports/live-task-drafts.port';
import {
  MEMORIES_BRIEFED_BEFORE,
  type MemoriesBriefedBeforePort,
} from '@work/application/ports/memories-briefed-before.port';
import { NETWORK_CALLS } from '@work/application/ports/network-calls.port';
import { NOTICES } from '@work/application/ports/notices.port';
import {
  OUTBOUND_TASK_NOTIFIER,
  type OutboundTaskNotifierPort,
} from '@work/application/ports/outbound-task-notifier.port';
import {
  PROCESSED_EVENTS,
  type ProcessedEventsPort,
} from '@work/application/ports/processed-events.port';
import {
  PULL_REQUEST_REVIEWING,
  type PullRequestReviewingPort,
} from '@work/application/ports/pull-request-reviewing.port';
import { QUEUED_PLACEMENTS } from '@work/application/ports/queued-placements.port';
import { REPLAY_CANDIDATES } from '@work/application/ports/replay-candidates.port';
import { REPLAY_DISPATCH } from '@work/application/ports/replay-dispatch.port';
import {
  REPLAY_FACTS,
  type ReplayFactsPort,
} from '@work/application/ports/replay-facts.port';
import {
  REPLAY_RUN_CLAIMS,
  type ReplayRunClaimsPort,
} from '@work/application/ports/replay-run-claims.port';
import { REPLAYABLE_RUNS } from '@work/application/ports/replayable-runs.port';
import {
  RUN_CONNECTIONS,
  type RunConnectionsPort,
} from '@work/application/ports/run-connections.port';
import { RUN_EVENT_READER } from '@work/application/ports/run-event-reader.port';
import {
  RUN_EVIDENCE,
  type RunEvidencePort,
} from '@work/application/ports/run-evidence.port';
import type { RunJournalPort } from '@work/application/ports/run-journal.port';
import { RUN_JOURNAL } from '@work/application/ports/run-journal.port';
import {
  RUN_JOURNAL_READER,
  type RunJournalReaderPort,
} from '@work/application/ports/run-journal-reader.port';
import { RUN_OUTCOMES } from '@work/application/ports/run-outcomes.port';
import { RUN_READER } from '@work/application/ports/run-reader.port';
import {
  RUN_SPENDS,
  type RunSpendReaderPort,
} from '@work/application/ports/run-spend-reader.port';
import type { RunStreamPort } from '@work/application/ports/run-stream.port';
import { RUN_STREAM } from '@work/application/ports/run-stream.port';
import {
  RUN_TOOLS,
  type RunToolsReaderPort,
} from '@work/application/ports/run-tools-reader.port';
import {
  RUN_USAGES,
  type RunUsageReaderPort,
} from '@work/application/ports/run-usage-reader.port';
import {
  RUN_USAGE_WRITER,
  type RunUsageWriterPort,
} from '@work/application/ports/run-usage-writer.port';
import { RUNNER_ACTIVITY_READER } from '@work/application/ports/runner-activity-reader.port';
import { RUNNER_TRACE_READER } from '@work/application/ports/runner-trace-reader.port';
import {
  SANDBOX_HOSTS,
  type SandboxHostsPort,
} from '@work/application/ports/sandbox-hosts.port';
import { SEARCH_AGENTS } from '@work/application/ports/search-agents.port';
import { SEARCH_DISPATCH } from '@work/application/ports/search-dispatch.port';
import { SEARCH_RUNS } from '@work/application/ports/search-runs.port';
import { SEARCH_VISIBILITY } from '@work/application/ports/search-visibility.port';
import { STARTING_POINT_HOLDS } from '@work/application/ports/starting-point-holds.port';
import {
  STATION_PROFILES,
  type StationProfilesPort,
} from '@work/application/ports/station-profiles.port';
import {
  STATION_RUN_READER,
  type StationRunReaderPort,
} from '@work/application/ports/station-run-reader.port';
import { STATION_RUNS } from '@work/application/ports/station-runs.port';
import {
  STATION_TALLIES,
  type StationTalliesPort,
} from '@work/application/ports/station-tallies.port';
import {
  TASK_DECISIONS,
  type TaskDecisionsPort,
} from '@work/application/ports/task-decisions.port';
import { TASK_DRAFT_STATES } from '@work/application/ports/task-draft-states.port';
import { TASK_NOTES_FROM_HOOKS } from '@work/application/ports/task-notes-from-hooks.port';
import {
  TASK_NOTICES,
  type TaskNoticesPort,
} from '@work/application/ports/task-notices.port';
import {
  TASK_PLACEMENTS,
  type TaskPlacementsPort,
} from '@work/application/ports/task-placements.port';
import { TASK_READER } from '@work/application/ports/task-reader.port';
import {
  TASK_VIEWS,
  type TaskViewsPort,
} from '@work/application/ports/task-views.port';
import { TASK_WORKSPACES } from '@work/application/ports/task-workspaces.port';
import {
  TEAM_INTEGRATIONS,
  type TeamIntegrationsPort,
} from '@work/application/ports/team-integrations.port';
import {
  TEAM_MEMORIES,
  type TeamMemoriesPort,
} from '@work/application/ports/team-memories.port';
import { TEAM_PROVISIONING } from '@work/application/ports/team-provisioning.port';
import {
  TEAM_SKILLS,
  type TeamSkillsPort,
} from '@work/application/ports/team-skills.port';
import {
  TRACE_PARENT,
  type TraceParentPort,
} from '@work/application/ports/trace-parent.port';
import {
  TRACED_TASK_READER,
  type TracedTaskReaderPort,
} from '@work/application/ports/traced-task-reader.port';
import { WORK_LOOKUP } from '@work/application/ports/work-lookup.port';
import {
  WORKSPACE_ARCHIVE_STORE,
  type WorkspaceArchiveStorePort,
} from '@work/application/ports/workspace-archive-store.port';
import {
  ListChatsQuery,
  ReadChatJournalQuery,
  ReadChatQuery,
} from '@work/application/queries/chat.queries';
import { HostRequirementsHandler } from '@work/application/queries/handlers/host-requirements.handler';
import { ImportLineHandler } from '@work/application/queries/handlers/import-line.handler';
import { JoinTaskDraftHandler } from '@work/application/queries/handlers/join-task-draft.handler';
import { ListChatsHandler } from '@work/application/queries/handlers/list-chats.handler';
import {
  HarnessCatalogueHandler,
  ListHarnessesHandler,
} from '@work/application/queries/handlers/list-harnesses.handler';
import { ListInboxHandler } from '@work/application/queries/handlers/list-inbox.handler';
import { ListLineResourcesHandler } from '@work/application/queries/handlers/list-line-resources.handler';
import { ListLinesHandler } from '@work/application/queries/handlers/list-lines.handler';
import { ListRunnerActivityHandler } from '@work/application/queries/handlers/list-runner-activity.handler';
import { ListTaskRunsHandler } from '@work/application/queries/handlers/list-task-runs.handler';
import { ListTasksHandler } from '@work/application/queries/handlers/list-tasks.handler';
import { ListTeamRunsHandler } from '@work/application/queries/handlers/list-team-runs.handler';
import { OnboardingHandler } from '@work/application/queries/handlers/onboarding.handler';
import { PendingMessagesHandler } from '@work/application/queries/handlers/pending-messages.handler';
import { PoolQueueHandler } from '@work/application/queries/handlers/pool-queue.handler';
import { ReadAttachmentHandler } from '@work/application/queries/handlers/read-attachment.handler';
import { ReadChatHandler } from '@work/application/queries/handlers/read-chat.handler';
import { ReadChatJournalHandler } from '@work/application/queries/handlers/read-chat-journal.handler';
import { ReadLineHandler } from '@work/application/queries/handlers/read-line.handler';
import { ReadReplayRunHandler } from '@work/application/queries/handlers/read-replay-run.handler';
import { ReadRunAttachmentHandler } from '@work/application/queries/handlers/read-run-attachment.handler';
import { ReadRunConfigHandler } from '@work/application/queries/handlers/read-run-config.handler';
import { ReadRunEventsHandler } from '@work/application/queries/handlers/read-run-events.handler';
import { ReadRunNetworkHandler } from '@work/application/queries/handlers/read-run-network.handler';
import { ReadRunNotesHandler } from '@work/application/queries/handlers/read-run-notes.handler';
import { ReadRunnerHistoryHandler } from '@work/application/queries/handlers/read-runner-history.handler';
import { ReadRunnerTraceHandler } from '@work/application/queries/handlers/read-runner-trace.handler';
import { ReadSearchRunHandler } from '@work/application/queries/handlers/read-search-run.handler';
import { ReadTaskDraftHandler } from '@work/application/queries/handlers/read-task-draft.handler';
import { ReadTaskJournalHandler } from '@work/application/queries/handlers/read-task-journal.handler';
import { ReadTaskTraceHandler } from '@work/application/queries/handlers/read-task-trace.handler';
import { RunStopRequestedHandler } from '@work/application/queries/handlers/run-stop-requested.handler';
import { StoredWorkspaceArchiveHandler } from '@work/application/queries/handlers/stored-workspace-archive.handler';
import { TurnAwaitsPersonHandler } from '@work/application/queries/handlers/turn-awaits-person.handler';
import { WatchRunHandler } from '@work/application/queries/handlers/watch-run.handler';
import { HostRequirementsQuery } from '@work/application/queries/host.queries';
import { ImportLineQuery } from '@work/application/queries/import-line.query';
import {
  HarnessCatalogueQuery,
  ListHarnessesQuery,
} from '@work/application/queries/list-harnesses.query';
import { ListInboxQuery } from '@work/application/queries/list-inbox.query';
import { ListLineResourcesQuery } from '@work/application/queries/list-line-resources.query';
import { ListLinesQuery } from '@work/application/queries/list-lines.query';
import { ListRunnerActivityQuery } from '@work/application/queries/list-runner-activity.query';
import { ListTaskRunsQuery } from '@work/application/queries/list-task-runs.query';
import { ListTasksQuery } from '@work/application/queries/list-tasks.query';
import { ListTeamRunsQuery } from '@work/application/queries/list-team-runs.query';
import { OnboardingQuery } from '@work/application/queries/onboarding.query';
import { PendingMessagesQuery } from '@work/application/queries/pending-messages.query';
import { PoolQueueQuery } from '@work/application/queries/pool.queries';
import { ReadAttachmentQuery } from '@work/application/queries/read-attachment.query';
import { ReadLineQuery } from '@work/application/queries/read-line.query';
import { ReadReplayRunQuery } from '@work/application/queries/read-replay-run.query';
import { ReadRunAttachmentQuery } from '@work/application/queries/read-run-attachment.query';
import { ReadRunConfigQuery } from '@work/application/queries/read-run-config.query';
import { ReadRunEventsQuery } from '@work/application/queries/read-run-events.query';
import { ReadRunNetworkQuery } from '@work/application/queries/read-run-network.query';
import { ReadRunNotesQuery } from '@work/application/queries/read-run-notes.query';
import { ReadRunnerHistoryQuery } from '@work/application/queries/read-runner-history.query';
import { ReadRunnerTraceQuery } from '@work/application/queries/read-runner-trace.query';
import { ReadSearchRunQuery } from '@work/application/queries/read-search-run.query';
import { ReadTaskJournalQuery } from '@work/application/queries/read-task-journal.query';
import { ReadTaskTraceQuery } from '@work/application/queries/read-task-trace.query';
import { RunStopRequestedQuery } from '@work/application/queries/run-stop-requested.query';
import { StoredWorkspaceArchiveQuery } from '@work/application/queries/stored-workspace-archive.query';
import {
  JoinTaskDraftQuery,
  ReadTaskDraftQuery,
} from '@work/application/queries/task-draft.queries';
import { TurnAwaitsPersonQuery } from '@work/application/queries/turn-awaits-person.query';
import { WatchRunQuery } from '@work/application/queries/watch-run.query';
import { ApplyLines } from '@work/application/services/apply-lines.service';
import {
  BUILT_IN_TOOL_USES,
  BuiltInTools,
  type BuiltInToolUse,
} from '@work/application/services/built-in-tools.service';
import { CandidateLines } from '@work/application/services/candidate-lines.service';
import { CarryGitCall } from '@work/application/services/carry-git-call.service';
import { CHAT_DISPATCH } from '@work/application/services/chat-dispatch';
import { ChatLoader } from '@work/application/services/chat-loader.service';
import { CiSetups } from '@work/application/services/ci-setups.service';
import { ClaimsTaken } from '@work/application/services/claims-taken.service';
import { ConnectionsMade } from '@work/application/services/connections-made.service';
import { ConversationLoader } from '@work/application/services/conversation-loader.service';
import { CreateTask } from '@work/application/services/create-task';
import { DispatchChat } from '@work/application/services/dispatch-chat.service';
import { DispatchReplay } from '@work/application/services/dispatch-replay.service';
import { DispatchSearch } from '@work/application/services/dispatch-search.service';
import { DispatchTask } from '@work/application/services/dispatch-task.service';
import { DraftSending } from '@work/application/services/draft-sending.service';
import { EgressSecretFetches } from '@work/application/services/egress-secret-fetches.service';
import { FilesLoader } from '@work/application/services/files-loader.service';
import { HoldStartingPoints } from '@work/application/services/hold-starting-points.service';
import { HookTraces } from '@work/application/services/hook-traces.service';
import { InboxRequestLoader } from '@work/application/services/inbox-request-loader.service';
import { InboxRequests } from '@work/application/services/inbox-requests.service';
import { IntegrationTaskViews } from '@work/application/services/integration-task-views.service';
import { IntegrationTools } from '@work/application/services/integration-tools.service';
import { LineLoader } from '@work/application/services/line-loader.service';
import { LineViews } from '@work/application/services/line-views.service';
import { LongPoll } from '@work/application/services/long-poll';
import { NetworkCalls } from '@work/application/services/network-calls.service';
import { NoticeLoader } from '@work/application/services/notice-loader.service';
import { Notices } from '@work/application/services/notices.service';
import { OpenPullRequest } from '@work/application/services/open-pull-request.service';
import { OutsideTaskNotices } from '@work/application/services/outside-task-notices.service';
import { PauseMarks } from '@work/application/services/pause-marks.service';
import { PausedRuns } from '@work/application/services/paused-runs.service';
import { ProposeTaskToolUse } from '@work/application/services/propose-task.tool-use';
import { ProvisionFailures } from '@work/application/services/provision-failures.service';
import { ProvisionWork } from '@work/application/services/provision-work.service';
import { PullRequestToolUse } from '@work/application/services/pull-request.tool-use';
import { PurgeProcessedEvents } from '@work/application/services/purge-processed-events.service';
import { PurgeRunConnections } from '@work/application/services/purge-run-connections.service';
import { ReactToHappenings } from '@work/application/services/react-to-happenings.service';
import { ReconcileSetup } from '@work/application/services/reconcile-setup.service';
import { RemoveReleasedArchives } from '@work/application/services/remove-released-archives.service';
import { ReplayAnswers } from '@work/application/services/replay-answers.service';
import { ReplayCandidates } from '@work/application/services/replay-candidates.service';
import { ReplayRuns } from '@work/application/services/replay-runs.service';
import { ReplayableRuns } from '@work/application/services/replayable-runs.service';
import { ReviewToolUse } from '@work/application/services/review.tool-use';
import { ReviewCommentToolUse } from '@work/application/services/review-comment.tool-use';
import { RunEvidences } from '@work/application/services/run-evidences.service';
import { RunLeases } from '@work/application/services/run-leases.service';
import { RunLoader } from '@work/application/services/run-loader.service';
import { RunStartHooks } from '@work/application/services/run-start-hooks.service';
import { RunWorks } from '@work/application/services/run-works.service';
import { RunnerLeases } from '@work/application/services/runner-leases.service';
import { SearchRuns } from '@work/application/services/search-runs.service';
import { SetupPullRequestToolUse } from '@work/application/services/setup-pull-request.tool-use';
import { SetupStatus } from '@work/application/services/setup-status.service';
import { StationCatalog } from '@work/application/services/station-catalog.service';
import { StationOrdering } from '@work/application/services/station-ordering';
import { StationRuns } from '@work/application/services/station-runs.service';
import { StationSkills } from '@work/application/services/station-skills.service';
import {
  TASK_DISPATCH,
  type TaskDispatching,
} from '@work/application/services/task-dispatch';
import { TaskViews } from '@work/application/services/task-views.service';
import { TeamIntegrations } from '@work/application/services/team-integrations.service';
import { ToolSources } from '@work/application/services/tool-sources.service';
import { ToolUsedHooks } from '@work/application/services/tool-used-hooks.service';
import { TouchedFiles } from '@work/application/services/touched-files';
import { TracesLoader } from '@work/application/services/traces-loader.service';
import { WorkLookup } from '@work/application/services/work-lookup.service';
import { WORK_PAYLOAD_TYPES } from '@work/domain/payload-types';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import { BUILT_IN_SKILL_KEY_LIST } from '@work/domain/services/built-in-skills';
import { AcpHarnessToolNames } from '@work/infrastructure/acp/harness-tools';
import { HocuspocusLiveTaskDrafts } from '@work/infrastructure/collab/hocuspocus-live-task-drafts';
import { TaskDraftCollab } from '@work/infrastructure/collab/task-draft.collab';
import { OutboxTeamProvisioning } from '@work/infrastructure/events/outbox-team-provisioning';
import { GitHubAccessibleRepositories } from '@work/infrastructure/github/github-accessible-repositories';
import {
  BuiltInHarnesses,
  DEFAULT_HARNESS,
} from '@work/infrastructure/harnesses/built-in-harnesses';
import { Sha256ContentHash } from '@work/infrastructure/hashing/sha256-content-hash';
import { CheckedRunJournal } from '@work/infrastructure/journal/checked-run-journal';
import { LineCompiler } from '@work/infrastructure/lines/line.compile';
import { RowsLineRendering } from '@work/infrastructure/lines/rows-line-rendering';
import { DrizzleProcessedEvents } from '@work/infrastructure/persistence/drizzle/ledgers/processed-events.ledger';
import { DrizzleReplayRunClaims } from '@work/infrastructure/persistence/drizzle/ledgers/replay-run-claims.ledger';
import { DrizzleRunConnections } from '@work/infrastructure/persistence/drizzle/ledgers/run-connections.ledger';
import { DrizzleRunJournal } from '@work/infrastructure/persistence/drizzle/ledgers/run-journal.ledger';
import { DrizzleRunUsages } from '@work/infrastructure/persistence/drizzle/ledgers/run-usages.ledger';
import { DrizzleArchiveReferences } from '@work/infrastructure/persistence/drizzle/readers/archive-references.reader';
import { DrizzleAttachmentReader } from '@work/infrastructure/persistence/drizzle/readers/attachment.reader';
import { DrizzleBriefedTasks } from '@work/infrastructure/persistence/drizzle/readers/briefed-tasks.reader';
import { DrizzleChatReader } from '@work/infrastructure/persistence/drizzle/readers/chat.reader';
import { DrizzleEnabledAtStations } from '@work/infrastructure/persistence/drizzle/readers/enabled-at-stations.reader';
import { DrizzleInboxReader } from '@work/infrastructure/persistence/drizzle/readers/inbox.reader';
import { DrizzleLeasedRunReader } from '@work/infrastructure/persistence/drizzle/readers/leased-run.reader';
import { DrizzleLineReader } from '@work/infrastructure/persistence/drizzle/readers/line.reader';
import { DrizzleLineDependents } from '@work/infrastructure/persistence/drizzle/readers/line-dependents.reader';
import { DrizzleLineImages } from '@work/infrastructure/persistence/drizzle/readers/line-images.reader';
import { DrizzleLineResources } from '@work/infrastructure/persistence/drizzle/readers/line-resources.reader';
import { DrizzleQueuedPlacements } from '@work/infrastructure/persistence/drizzle/readers/queued-placements.reader';
import { DrizzleReplayFacts } from '@work/infrastructure/persistence/drizzle/readers/replay-facts.reader';
import { DrizzleRunReader } from '@work/infrastructure/persistence/drizzle/readers/run.reader';
import { DrizzleRunEventReader } from '@work/infrastructure/persistence/drizzle/readers/run-event.reader';
import { DrizzleRunJournalReader } from '@work/infrastructure/persistence/drizzle/readers/run-journal.reader';
import { DrizzleRunnerActivityReader } from '@work/infrastructure/persistence/drizzle/readers/runner-activity.reader';
import { DrizzleRunnerTraceReader } from '@work/infrastructure/persistence/drizzle/readers/runner-trace.reader';
import { DrizzleSearchRunFacts } from '@work/infrastructure/persistence/drizzle/readers/search-run-facts.reader';
import { DrizzleStationRunReader } from '@work/infrastructure/persistence/drizzle/readers/station-run.reader';
import { DrizzleStationTallies } from '@work/infrastructure/persistence/drizzle/readers/station-tallies.reader';
import { DrizzleTaskReader } from '@work/infrastructure/persistence/drizzle/readers/task.reader';
import { DrizzleTaskPlacements } from '@work/infrastructure/persistence/drizzle/readers/task-placements.reader';
import { DrizzleTaskWorkspaces } from '@work/infrastructure/persistence/drizzle/readers/task-workspaces.reader';
import { DrizzleTracedTaskReader } from '@work/infrastructure/persistence/drizzle/readers/traced-task.reader';
import { DrizzleChatRepository } from '@work/infrastructure/persistence/drizzle/repositories/chat.repository';
import { DrizzleInboxRequestRepository } from '@work/infrastructure/persistence/drizzle/repositories/inbox-request.repository';
import { DrizzleLineRepository } from '@work/infrastructure/persistence/drizzle/repositories/line.repository';
import { DrizzleNetworkCallRepository } from '@work/infrastructure/persistence/drizzle/repositories/network-call.repository';
import { DrizzleNoticeRepository } from '@work/infrastructure/persistence/drizzle/repositories/notice.repository';
import { DrizzleRunRepository } from '@work/infrastructure/persistence/drizzle/repositories/run.repository';
import { DrizzleStartingPointHoldRepository } from '@work/infrastructure/persistence/drizzle/repositories/starting-point-hold.repository';
import { DrizzleTaskRepository } from '@work/infrastructure/persistence/drizzle/repositories/task.repository';
import { DrizzleTaskDraftRepository } from '@work/infrastructure/persistence/drizzle/repositories/task-draft.repository';
import { DrizzleWorkspaceArchiveRepository } from '@work/infrastructure/persistence/drizzle/repositories/workspace-archive.repository';
import { S3AttachmentStore } from '@work/infrastructure/storage/s3-attachment.store';
import { S3Readiness } from '@work/infrastructure/storage/s3-readiness';
import { S3WorkspaceArchiveStore } from '@work/infrastructure/storage/s3-workspace-archive.store';
import { StorageHosts } from '@work/infrastructure/storage/storage-hosts';
import { InMemoryRunStream } from '@work/infrastructure/streaming/in-memory-run-stream';
import { RunGauges } from '@work/infrastructure/telemetry/run-gauges';
import { HashedTraceParent } from '@work/infrastructure/tracing/hashed-trace-parent';
import { workSubscribers } from '@work/presentation/events/work.subscribers';
import { AttachmentController } from '@work/presentation/http/controllers/attachment.controller';
import { ChatController } from '@work/presentation/http/controllers/chat.controller';
import { EgressController } from '@work/presentation/http/controllers/egress.controller';
import { GitController } from '@work/presentation/http/controllers/git.controller';
import { HarnessController } from '@work/presentation/http/controllers/harness.controller';
import { HostWorkController } from '@work/presentation/http/controllers/host-work.controller';
import { InboxController } from '@work/presentation/http/controllers/inbox.controller';
import { LineController } from '@work/presentation/http/controllers/line.controller';
import { LineResourceController } from '@work/presentation/http/controllers/line-resource.controller';
import { OnboardingController } from '@work/presentation/http/controllers/onboarding.controller';
import { PoolController } from '@work/presentation/http/controllers/pool.controller';
import { ReplayRunController } from '@work/presentation/http/controllers/replay-run.controller';
import { RunController } from '@work/presentation/http/controllers/run.controller';
import { RunStreamController } from '@work/presentation/http/controllers/run-stream.controller';
import { RunnerController } from '@work/presentation/http/controllers/runner.controller';
import { RunnerActivityController } from '@work/presentation/http/controllers/runner-activity.controller';
import { TaskController } from '@work/presentation/http/controllers/task.controller';
import { WorkspaceArchiveController } from '@work/presentation/http/controllers/workspace-archive.controller';
import { NetworkCallsWorker } from '@work/presentation/workers/network-calls.worker';
import { ProcessedEventsWorker } from '@work/presentation/workers/processed-events.worker';
import { ProvisionWorkWorker } from '@work/presentation/workers/provision-work.worker';
import { RunConnectionsWorker } from '@work/presentation/workers/run-connections.worker';
import { WorkspaceArchivesWorker } from '@work/presentation/workers/workspace-archives.worker';

const WORK_EVENTS = Symbol('WORK_EVENTS');

const CONTROL_PLANE_HOST = Symbol('CONTROL_PLANE_HOST');

const CONTROL_PLANE_PORT = Symbol('CONTROL_PLANE_PORT');

const WORK_DEPENDENTS = Symbol('WORK_DEPENDENTS');

export const WORK_CONTROLLERS: readonly Type[] = [
  LineController,
  LineResourceController,
  RunController,
  RunStreamController,
  RunnerController,
  WorkspaceArchiveController,
  PoolController,
  HostWorkController,
  EgressController,
  RunnerActivityController,
  HarnessController,
  InboxController,
  AttachmentController,
  GitController,
  TaskController,
  ReplayRunController,
  ChatController,
  OnboardingController,
];

export const WORK_PROVIDERS: readonly Provider[] = [
  RunGauges,
  { provide: ENABLED_AT_STATIONS, useClass: DrizzleEnabledAtStations },
  DrizzleLineDependents,
  {
    provide: WORK_DEPENDENTS,
    inject: [TEAM_DEPENDENTS, DrizzleLineDependents],
    useFactory: (
      dependents: TeamDependentsPort,
      lines: DrizzleLineDependents,
    ) => {
      dependents.register(lines);
      return true;
    },
  },

  {
    provide: WORK_LOOKUP,
    inject: [
      DrizzleRunRepository,
      DrizzleTaskRepository,
      DrizzleLineRepository,
      DrizzleChatRepository,
      RUN_JOURNAL_READER,
    ],
    useFactory: (
      runs: DrizzleRunRepository,
      tasks: DrizzleTaskRepository,
      lines: DrizzleLineRepository,
      chats: DrizzleChatRepository,
      journals: RunJournalReaderPort,
    ) => new WorkLookup(runs, tasks, lines, chats, journals),
  },

  {
    provide: RUN_EVIDENCE,
    inject: [
      DrizzleRunRepository,
      DrizzleTaskRepository,
      DrizzleLineRepository,
      RUN_JOURNAL_READER,
      BRIEFED_TASKS,
      CONTENT_HASH,
    ],
    useFactory: (
      runs: DrizzleRunRepository,
      tasks: DrizzleTaskRepository,
      lines: DrizzleLineRepository,
      journals: RunJournalReaderPort,
      briefed: BriefedTasksPort,
      hash: ContentHashPort,
    ) => new RunEvidences(runs, tasks, lines, journals, briefed, hash),
  },

  DrizzleRunRepository,

  { provide: PROCESSED_EVENTS, useClass: DrizzleProcessedEvents },

  DrizzleLineRepository,

  DrizzleTaskRepository,

  DrizzleTaskDraftRepository,

  { provide: TASK_DRAFT_STATES, useExisting: DrizzleTaskDraftRepository },

  { provide: TASK_WORKSPACES, useClass: DrizzleTaskWorkspaces },

  { provide: LIVE_TASK_DRAFTS, useClass: HocuspocusLiveTaskDrafts },

  {
    provide: DraftSending,
    inject: [
      DrizzleTaskDraftRepository,
      WORKSPACE_ACCESS,
      LIVE_TASK_DRAFTS,
      LOGGER,
    ],
    useFactory: (
      drafts: DrizzleTaskDraftRepository,
      access: WorkspaceAccessPort,
      live: LiveTaskDraftsPort,
      logger: LoggerPort,
    ) => new DraftSending(drafts, access, live, logger),
  },

  TaskDraftCollab,

  DrizzleChatRepository,

  DrizzleWorkspaceArchiveRepository,

  DrizzleNetworkCallRepository,

  DrizzleInboxRequestRepository,

  {
    provide: InboxRequests,
    inject: [
      DrizzleInboxRequestRepository,
      DrizzleTaskRepository,
      TRANSACTION,
      ID_GENERATOR,
      CLOCK,
    ],
    useFactory: (
      inboxRequests: DrizzleInboxRequestRepository,
      tasks: DrizzleTaskRepository,
      transaction: TransactionPort,
      ids: IdGeneratorPort,
      clock: ClockPort,
    ) => new InboxRequests(inboxRequests, tasks, transaction, ids, clock),
  },
  { provide: INBOX_REQUESTS, useExisting: InboxRequests },

  DrizzleNoticeRepository,

  {
    provide: Notices,
    inject: [
      DrizzleNoticeRepository,
      WORKSPACE_ACCESS,
      TRANSACTION,
      ID_GENERATOR,
      CLOCK,
    ],
    useFactory: (
      notices: DrizzleNoticeRepository,
      access: WorkspaceAccessPort,
      transaction: TransactionPort,
      ids: IdGeneratorPort,
      clock: ClockPort,
    ) => new Notices(notices, access, transaction, ids, clock),
  },
  {
    provide: NoticeLoader,
    inject: [DrizzleNoticeRepository, WORKSPACE_ACCESS],
    useFactory: (
      notices: DrizzleNoticeRepository,
      access: WorkspaceAccessPort,
    ) => new NoticeLoader(notices, access),
  },
  { provide: NOTICES, useExisting: Notices },

  {
    provide: InboxRequestLoader,
    inject: [
      DrizzleInboxRequestRepository,
      DrizzleTaskRepository,
      DrizzleLineRepository,
      WORKSPACE_ACCESS,
    ],
    useFactory: (
      inboxRequests: DrizzleInboxRequestRepository,
      tasks: DrizzleTaskRepository,
      lines: DrizzleLineRepository,
      access: WorkspaceAccessPort,
    ) => new InboxRequestLoader(inboxRequests, tasks, lines, access),
  },

  {
    provide: TaskViews,
    inject: [
      DrizzleTaskRepository,
      DrizzleLineRepository,
      WORKSPACE_READER,
      PROCESSED_EVENTS,
      TASK_PLACEMENTS,
      TASK_DISPATCH,
      TRANSACTION,
      CLOCK,
      ENV,
    ],
    useFactory: (
      tasks: DrizzleTaskRepository,
      lines: DrizzleLineRepository,
      workspaces: WorkspaceReaderPort,
      processedEvents: ProcessedEventsPort,
      placements: TaskPlacementsPort,
      dispatch: DispatchTask,
      transaction: TransactionPort,
      clock: ClockPort,
      env: Env,
    ) =>
      new TaskViews(
        tasks,
        lines,
        workspaces,
        processedEvents,
        placements,
        dispatch,
        transaction,
        clock,
        publicUrlOf(env),
      ),
  },

  { provide: TASK_VIEWS, useExisting: TaskViews },

  { provide: TASK_NOTES_FROM_HOOKS, useExisting: TaskViews },

  {
    provide: HOOK_TRACES,
    inject: [DrizzleRunRepository, RUN_JOURNAL, RUN_STREAM],
    useFactory: (
      runs: DrizzleRunRepository,
      journal: RunJournalPort,
      stream: RunStreamPort,
    ) => new HookTraces(runs, journal, stream),
  },

  {
    provide: NetworkCalls,
    inject: [DrizzleNetworkCallRepository, ID_GENERATOR, CLOCK],
    useFactory: (
      calls: DrizzleNetworkCallRepository,
      ids: IdGeneratorPort,
      clock: ClockPort,
    ) => new NetworkCalls(calls, ids, clock),
  },

  { provide: NETWORK_CALLS, useExisting: NetworkCalls },

  {
    provide: NetworkCallsWorker,
    inject: [NetworkCalls, LOGGER],
    useFactory: (calls: NetworkCalls, logger: LoggerPort) =>
      new NetworkCallsWorker(calls, logger),
  },

  {
    provide: PurgeProcessedEvents,
    inject: [PROCESSED_EVENTS, CLOCK],
    useFactory: (processedEvents: ProcessedEventsPort, clock: ClockPort) =>
      new PurgeProcessedEvents(processedEvents, clock),
  },

  {
    provide: ProcessedEventsWorker,
    inject: [PurgeProcessedEvents, LOGGER],
    useFactory: (purging: PurgeProcessedEvents, logger: LoggerPort) =>
      new ProcessedEventsWorker(purging, logger),
  },

  {
    provide: LongPoll,
    inject: [CLOCK, ENV],
    useFactory: (clock: ClockPort, env: Env) =>
      new LongPoll(clock, env.SPOTLIGHT_LONG_POLL_MS),
  },

  {
    provide: RunStartHooks,
    inject: [DrizzleRunRepository, TASK_VIEWS, LIFECYCLE_HOOKS, CLOCK, LOGGER],
    useFactory: (
      runs: DrizzleRunRepository,
      taskViews: TaskViewsPort,
      hooks: LifecycleHooksPort,
      clock: ClockPort,
      logger: LoggerPort,
    ) => new RunStartHooks(runs, taskViews, hooks, clock, logger),
  },

  {
    provide: ClaimsTaken,
    inject: [DrizzleRunRepository, CHECK_WORK, RUNNERS, CLOCK, LOGGER],
    useFactory: (
      runs: DrizzleRunRepository,
      checks: CheckWorkPort,
      runners: RunnersPort,
      clock: ClockPort,
      logger: LoggerPort,
    ) => new ClaimsTaken(runs, checks, runners, clock, logger),
  },

  { provide: ARCHIVE_REFERENCES, useClass: DrizzleArchiveReferences },
  { provide: TEAM_PROVISIONING, useClass: OutboxTeamProvisioning },
  { provide: BRIEFED_TASKS, useClass: DrizzleBriefedTasks },

  { provide: CHAT_READER, useClass: DrizzleChatReader },

  { provide: LINE_READER, useClass: DrizzleLineReader },
  { provide: LINE_IMAGES, useClass: DrizzleLineImages },

  { provide: TASK_READER, useClass: DrizzleTaskReader },

  { provide: INBOX_READER, useClass: DrizzleInboxReader },

  { provide: RUNNER_ACTIVITY_READER, useClass: DrizzleRunnerActivityReader },

  { provide: RUN_READER, useClass: DrizzleRunReader },

  { provide: RUNNER_TRACE_READER, useClass: DrizzleRunnerTraceReader },

  { provide: TRACED_TASK_READER, useClass: DrizzleTracedTaskReader },

  { provide: HARNESS_LAUNCH, useExisting: BuiltInHarnesses },
  { provide: HARNESS_TOOL_NAMES, useClass: AcpHarnessToolNames },

  { provide: HARNESS_PROFILE_REVIEW, useExisting: BuiltInHarnesses },

  { provide: RUN_JOURNAL_READER, useClass: DrizzleRunJournalReader },

  { provide: ATTACHMENT_READER, useClass: DrizzleAttachmentReader },

  {
    provide: CONTROL_PLANE_RELEASE,
    inject: [ENV],
    useFactory: (env: Env): ControlPlaneReleasePort => ({
      release: env.SPOTLIGHT_RELEASE || null,
    }),
  },

  {
    provide: SANDBOX_HOSTS,
    inject: [ENV],
    useFactory: (env: Env) => new StorageHosts(env),
  },

  {
    provide: ATTACHMENT_STORE,
    inject: [ENV],
    useFactory: (env: Env) => new S3AttachmentStore(s3ClientsOf(env)),
  },

  {
    provide: S3Readiness,
    inject: [ReadinessChecks, ENV],
    useFactory: (checks: ReadinessChecks, env: Env) => {
      const { store, bucket } = s3ClientsOf(env);
      const s3 = new S3Readiness(store, bucket);
      checks.register(s3);
      return s3;
    },
  },

  {
    provide: FilesLoader,
    inject: [ATTACHMENT_STORE],
    useFactory: (files: AttachmentStorePort) => new FilesLoader(files),
  },

  {
    provide: TracesLoader,
    inject: [TRACED_TASK_READER],
    useFactory: (tasks: TracedTaskReaderPort) => new TracesLoader(tasks),
  },

  DrizzleRunUsages,

  { provide: RUN_USAGES, useExisting: DrizzleRunUsages },

  { provide: RUN_USAGE_WRITER, useExisting: DrizzleRunUsages },
  { provide: RUN_TOOLS, useExisting: DrizzleRunUsages },

  { provide: RUN_SPENDS, useExisting: DrizzleRunUsages },

  { provide: STATION_RUN_READER, useClass: DrizzleStationRunReader },

  {
    provide: STATION_RUNS,
    inject: [STATION_RUN_READER, TEAM_SKILLS],
    useFactory: (reader: StationRunReaderPort, skills: TeamSkillsPort) =>
      new StationRuns(reader, skills),
  },

  { provide: RUN_EVENT_READER, useClass: DrizzleRunEventReader },

  { provide: RUN_STREAM, useClass: InMemoryRunStream },

  {
    provide: RunLeases,
    inject: [DrizzleRunRepository],
    useFactory: (runs: DrizzleRunRepository) => new RunLeases(runs),
  },

  DrizzleRunJournal,

  {
    provide: RUN_JOURNAL,
    inject: [DrizzleRunJournal, LOGGER, TELEMETRY],
    useFactory: (
      journal: DrizzleRunJournal,
      logger: LoggerPort,
      telemetry: TelemetryPort,
    ) => new CheckedRunJournal(journal, logger, telemetry),
  },

  { provide: LEASED_RUN_READER, useClass: DrizzleLeasedRunReader },

  {
    provide: TeamIntegrations,
    inject: [TEAM_INTEGRATIONS],
    useFactory: (integrations: TeamIntegrationsPort) =>
      new TeamIntegrations(integrations),
  },

  { provide: LINE_COMPILER, useClass: LineCompiler },

  {
    provide: SetupStatus,
    inject: [WORKSPACE_CONNECTIONS, RUNNER_READER, CHAT_READER],
    useFactory: (
      connections: WorkspaceConnectionsPort,
      runners: RunnerReaderPort,
      chats: ChatReaderPort,
    ) => new SetupStatus(connections, runners, chats),
  },

  {
    provide: ACCESSIBLE_REPOSITORIES,
    inject: [INSTALLATION_REPOSITORIES],
    useFactory: (repositories: InstallationRepositoriesPort) =>
      new GitHubAccessibleRepositories(repositories),
  },

  {
    provide: StationCatalog,
    inject: [CATALOG],
    useFactory: (catalog: CatalogPort) => new StationCatalog(catalog),
  },

  {
    provide: ToolSources,
    inject: [BuiltInTools, INTEGRATION_TOOLS, StationCatalog],
    useFactory: (
      builtIns: BuiltInTools,
      integrations: IntegrationToolsPort,
      catalog: StationCatalog,
    ) => new ToolSources(builtIns, integrations, catalog),
  },

  {
    provide: StationSkills,
    inject: [TEAM_SKILLS],
    useFactory: (skills: TeamSkillsPort) => new StationSkills(skills),
  },

  { provide: STATION_TALLIES, useClass: DrizzleStationTallies },

  { provide: TASK_PLACEMENTS, useClass: DrizzleTaskPlacements },

  {
    provide: ApplyLines,
    inject: [DrizzleLineRepository, STATION_TALLIES, ID_GENERATOR],
    useFactory: (
      lines: DrizzleLineRepository,
      tallies: StationTalliesPort,
      ids: IdGeneratorPort,
    ) => new ApplyLines(lines, tallies, ids),
  },

  {
    provide: LineViews,
    inject: [TEAM_DIRECTORY],
    useFactory: (teams: TeamDirectoryPort) => new LineViews(teams),
  },

  { provide: LINE_RESOURCES, useClass: DrizzleLineResources },

  {
    provide: LineLoader,
    inject: [WORKSPACE_ACCESS, DrizzleLineRepository],
    useFactory: (access: WorkspaceAccessPort, lines: DrizzleLineRepository) =>
      new LineLoader(access, lines),
  },

  {
    provide: HAPPENING_REACTIONS,
    inject: [
      DrizzleTaskRepository,
      TASK_PLACEMENTS,
      DrizzleLineRepository,
      TASK_DISPATCH,
      TRANSACTION,
      CLOCK,
      ID_GENERATOR,
      MEMBER_DIRECTORY,
      ATTACHMENT_STORE,
      PROCESSED_EVENTS,
      LOGGER,
    ],
    useFactory: (
      tasks: DrizzleTaskRepository,
      placements: TaskPlacementsPort,
      lines: DrizzleLineRepository,
      dispatch: TaskDispatching,
      transaction: TransactionPort,
      clock: ClockPort,
      ids: IdGeneratorPort,
      members: MemberDirectoryPort,
      files: AttachmentStorePort,
      processedEvents: ProcessedEventsPort,
      logger: LoggerPort,
    ) =>
      new ReactToHappenings(
        tasks,
        placements,
        lines,
        dispatch,
        transaction,
        clock,
        ids,
        members,
        files,
        processedEvents,
        logger,
      ),
  },

  {
    provide: ReconcileSetup,
    inject: [
      DrizzleTaskRepository,
      DrizzleLineRepository,
      SetupStatus,
      CLOCK,
      LOGGER,
    ],
    useFactory: (
      tasks: DrizzleTaskRepository,
      lines: LineRepository,
      setup: SetupStatus,
      clock: ClockPort,
      logger: LoggerPort,
    ) => new ReconcileSetup(tasks, lines, setup, clock, logger),
  },

  {
    provide: RunLoader,
    inject: [DrizzleRunRepository, DrizzleTaskRepository],
    useFactory: (runs: DrizzleRunRepository, tasks: DrizzleTaskRepository) =>
      new RunLoader(runs, tasks),
  },

  {
    provide: ConversationLoader,
    inject: [DrizzleTaskRepository, DrizzleLineRepository],
    useFactory: (tasks: DrizzleTaskRepository, lines: DrizzleLineRepository) =>
      new ConversationLoader(tasks, lines),
  },

  {
    provide: RunWorks,
    inject: [
      DrizzleRunRepository,
      DrizzleTaskRepository,
      DrizzleChatRepository,
      DrizzleLineRepository,
      BRIEFED_TASKS,
      CLOCK,
    ],
    useFactory: (
      runs: DrizzleRunRepository,
      tasks: DrizzleTaskRepository,
      chats: DrizzleChatRepository,
      lines: DrizzleLineRepository,
      briefedTasks: BriefedTasksPort,
      clock: ClockPort,
    ) => new RunWorks(runs, tasks, chats, lines, briefedTasks, clock),
  },

  {
    provide: GIT_GATEWAY,
    inject: [
      RunWorks,
      WORKSPACE_CONNECTIONS,
      REPOSITORY_GIT,
      CHECK_ACCESS,
      CLOCK,
    ],
    useFactory: (
      works: RunWorks,
      workspaces: WorkspaceConnectionsPort,
      git: RepositoryGitPort,
      checking: CheckAccessPort,
      clock: ClockPort,
    ) => new CarryGitCall(works, workspaces, git, checking, clock),
  },

  {
    provide: ChatLoader,
    inject: [DrizzleChatRepository],
    useFactory: (chats: DrizzleChatRepository) => new ChatLoader(chats),
  },

  {
    provide: CiSetups,
    inject: [REPOSITORY_SETTINGS, GITHUB_ACTIONS_TRUSTS, ENV],
    useFactory: (
      settings: RepositorySettingsPort,
      trusts: GitHubActionsTrustsPort,
      env: Env,
    ) => new CiSetups(settings, trusts, publicUrlOf(env)),
  },

  {
    provide: CHAT_DISPATCH,
    inject: [
      DrizzleRunRepository,
      ID_GENERATOR,
      HARNESS_LAUNCH,
      TRACE_PARENT,
      TEAM_DIRECTORY,
      DrizzleLineRepository,
      CLOCK,
      TEAM_MEMORIES,
      LOGGER,
      SAVEPOINT,
      ENV,
    ],
    useFactory: (
      runs: DrizzleRunRepository,
      ids: IdGeneratorPort,
      launch: HarnessLaunchPort,
      tracing: TraceParentPort,
      teams: TeamDirectoryPort,
      lines: DrizzleLineRepository,
      clock: ClockPort,
      memories: TeamMemoriesPort,
      logger: LoggerPort,
      savepoint: SavepointPort,
      env: Env,
    ) =>
      new DispatchChat(
        runs,
        ids,
        launch,
        tracing,
        teams,
        lines,
        clock,
        memories,
        logger,
        savepoint,
        publicUrlOf(env),
      ),
  },

  {
    provide: CreateTaskFromProposal,
    inject: [
      DrizzleChatRepository,
      DrizzleLineRepository,
      TASK_PLACEMENTS,
      CreateTask,
      ID_GENERATOR,
      CLOCK,
    ],
    useFactory: (
      chats: DrizzleChatRepository,
      lines: DrizzleLineRepository,
      placements: TaskPlacementsPort,
      createTask: CreateTask,
      ids: IdGeneratorPort,
      clock: ClockPort,
    ) =>
      new CreateTaskFromProposal(
        chats,
        lines,
        placements,
        createTask,
        ids,
        clock,
      ),
  },

  BuiltInHarnesses,

  { provide: TRACE_PARENT, useClass: HashedTraceParent },

  { provide: CONTENT_HASH, useClass: Sha256ContentHash },

  {
    provide: BUILT_IN_SKILL_KEYS,
    useValue: BUILT_IN_SKILL_KEY_LIST.map((each) => each.value),
  },

  {
    provide: TASK_DISPATCH,
    inject: [
      DrizzleRunRepository,
      ID_GENERATOR,
      BuiltInHarnesses,
      HARNESS_LAUNCH,
      TRACE_PARENT,
      BUILT_IN_SKILLS,
      StationSkills,
      TeamIntegrations,
      TASK_DECISIONS,
      StationCatalog,
      STATION_PROFILES,
      TEAM_MEMORIES,
      TouchedFiles,
      LOGGER,
      SAVEPOINT,
      CONTENT_HASH,
    ],
    useFactory: (
      runs: DrizzleRunRepository,
      ids: CryptoIdGenerator,
      harnesses: BuiltInHarnesses,
      launch: HarnessLaunchPort,
      tracing: TraceParentPort,
      skills: BuiltInSkillsPort,
      teamSkills: StationSkills,
      integrations: TeamIntegrations,
      decisions: TaskDecisionsPort,
      catalog: StationCatalog,
      profiles: StationProfilesPort,
      memories: TeamMemoriesPort,
      touched: TouchedFiles,
      logger: LoggerPort,
      savepoint: SavepointPort,
      hash: ContentHashPort,
    ) =>
      new DispatchTask(
        runs,
        ids,
        harnesses,
        launch,
        tracing,
        skills,
        teamSkills,
        integrations,
        decisions,
        catalog,
        profiles,
        memories,
        touched,
        logger,
        savepoint,
        hash,
      ),
  },

  {
    provide: DispatchReplay,
    inject: [
      DrizzleRunRepository,
      DrizzleWorkspaceArchiveRepository,
      DrizzleTaskRepository,
      BRIEFED_TASKS,
      ID_GENERATOR,
      BuiltInHarnesses,
      HARNESS_LAUNCH,
      TRACE_PARENT,
      BUILT_IN_SKILLS,
      StationSkills,
      StationCatalog,
      STATION_PROFILES,
      MEMORIES_BRIEFED_BEFORE,
      ATTACHMENT_STORE,
      CONTENT_HASH,
      ReplayAnswers,
    ],
    useFactory: (
      runs: DrizzleRunRepository,
      archives: DrizzleWorkspaceArchiveRepository,
      tasks: DrizzleTaskRepository,
      briefedTasks: BriefedTasksPort,
      ids: CryptoIdGenerator,
      harnesses: BuiltInHarnesses,
      launch: HarnessLaunchPort,
      tracing: TraceParentPort,
      skills: BuiltInSkillsPort,
      teamSkills: StationSkills,
      catalog: StationCatalog,
      profiles: StationProfilesPort,
      memories: MemoriesBriefedBeforePort,
      files: AttachmentStorePort,
      hash: ContentHashPort,
      answers: ReplayAnswers,
    ) =>
      new DispatchReplay(
        runs,
        archives,
        tasks,
        briefedTasks,
        ids,
        harnesses,
        launch,
        tracing,
        skills,
        teamSkills,
        catalog,
        profiles,
        memories,
        files,
        hash,
        answers,
      ),
  },

  {
    provide: CandidateLines,
    inject: [
      DrizzleLineRepository,
      LINE_RESOURCES,
      LINE_COMPILER,
      StationCatalog,
      BuiltInHarnesses,
      HARNESS_LAUNCH,
      BUILT_IN_SKILLS,
      StationSkills,
      STATION_PROFILES,
      CONTENT_HASH,
      ID_GENERATOR,
    ],
    useFactory: (
      lines: DrizzleLineRepository,
      resources: LineResourcesPort,
      compiler: LineCompilerPort,
      catalog: StationCatalog,
      harnesses: BuiltInHarnesses,
      launch: HarnessLaunchPort,
      skills: BuiltInSkillsPort,
      teamSkills: StationSkills,
      profiles: StationProfilesPort,
      hash: ContentHashPort,
      ids: IdGeneratorPort,
    ) =>
      new CandidateLines(
        lines,
        resources,
        compiler,
        catalog,
        new StationOrdering(
          harnesses,
          launch,
          skills,
          teamSkills,
          catalog,
          profiles,
          hash,
        ),
        ids,
      ),
  },

  {
    provide: REPLAY_CANDIDATES,
    inject: [CandidateLines, LINE_RENDERING, CONTENT_HASH],
    useFactory: (
      candidates: CandidateLines,
      rendering: LineRenderingPort,
      hash: ContentHashPort,
    ) => new ReplayCandidates(candidates, rendering, hash),
  },

  { provide: LINE_RENDERING, useClass: RowsLineRendering },

  {
    provide: REPLAYABLE_RUNS,
    inject: [
      REPLAY_FACTS,
      DrizzleRunRepository,
      DrizzleLineRepository,
      DispatchReplay,
      STATION_RUN_READER,
      RUN_USAGES,
      ID_GENERATOR,
      LOGGER,
    ],
    useFactory: (
      facts: ReplayFactsPort,
      runs: DrizzleRunRepository,
      lines: DrizzleLineRepository,
      dispatch: DispatchReplay,
      stationRuns: StationRunReaderPort,
      usages: RunUsageReaderPort,
      ids: IdGeneratorPort,
      logger: LoggerPort,
    ) =>
      new ReplayableRuns(
        facts,
        runs,
        lines,
        dispatch,
        stationRuns,
        usages,
        ids,
        logger,
      ),
  },

  { provide: REPLAY_FACTS, useClass: DrizzleReplayFacts },

  {
    provide: REPLAY_DISPATCH,
    inject: [
      DrizzleRunRepository,
      REPLAY_RUN_CLAIMS,
      CandidateLines,
      DispatchReplay,
      ReplayAnswers,
      TRANSACTION,
      CLOCK,
    ],
    useFactory: (
      runs: DrizzleRunRepository,
      claims: ReplayRunClaimsPort,
      candidates: CandidateLines,
      dispatch: DispatchReplay,
      answers: ReplayAnswers,
      transaction: TransactionPort,
      clock: ClockPort,
    ) =>
      new ReplayRuns(
        runs,
        claims,
        candidates,
        dispatch,
        answers,
        transaction,
        clock,
      ),
  },

  {
    provide: ReplayAnswers,
    inject: [DrizzleTaskRepository, RUN_EVIDENCE],
    useFactory: (tasks: DrizzleTaskRepository, evidence: RunEvidencePort) =>
      new ReplayAnswers(tasks, evidence),
  },

  { provide: REPLAY_RUN_CLAIMS, useClass: DrizzleReplayRunClaims },

  {
    provide: SEARCH_DISPATCH,
    inject: [
      DrizzleRunRepository,
      DrizzleLineRepository,
      HARNESS_LAUNCH,
      TRACE_PARENT,
      TRANSACTION,
      CLOCK,
    ],
    useFactory: (
      runs: DrizzleRunRepository,
      lines: DrizzleLineRepository,
      launch: HarnessLaunchPort,
      tracing: TraceParentPort,
      transaction: TransactionPort,
      clock: ClockPort,
    ) => new DispatchSearch(runs, lines, launch, tracing, transaction, clock),
  },

  {
    provide: SEARCH_RUNS,
    inject: [DrizzleRunRepository, DrizzleSearchRunFacts],
    useFactory: (runs: DrizzleRunRepository, facts: DrizzleSearchRunFacts) =>
      new SearchRuns(runs, facts),
  },

  DrizzleSearchRunFacts,

  DrizzleStartingPointHoldRepository,

  {
    provide: STARTING_POINT_HOLDS,
    inject: [DrizzleStartingPointHoldRepository, TRANSACTION],
    useFactory: (
      holds: DrizzleStartingPointHoldRepository,
      transaction: TransactionPort,
    ) => new HoldStartingPoints(holds, transaction),
  },

  {
    provide: TouchedFiles,
    inject: [RUN_JOURNAL_READER, PULL_REQUESTS, LOGGER, CLOCK],
    useFactory: (
      journals: RunJournalReaderPort,
      pullRequests: PullRequestPort,
      logger: LoggerPort,
      clock: ClockPort,
    ) => new TouchedFiles(journals, pullRequests, logger, clock),
  },

  {
    provide: CreateTask,
    inject: [DrizzleTaskRepository, TASK_DISPATCH, TRANSACTION, FilesLoader],
    useFactory: (
      tasks: DrizzleTaskRepository,
      dispatch: DispatchTask,
      transaction: TransactionPort,
      files: FilesLoader,
    ) => new CreateTask(tasks, dispatch, transaction, files),
  },

  {
    provide: IntegrationTaskViews,
    inject: [DrizzleLineRepository],
    useFactory: (lines: DrizzleLineRepository) =>
      new IntegrationTaskViews(lines),
  },

  {
    provide: OUTBOUND_TASK_NOTIFIER,
    inject: [IntegrationTaskViews, TASK_NOTICES],
    useFactory: (taskViews: IntegrationTaskViews, notices: TaskNoticesPort) =>
      new OutsideTaskNotices(taskViews, notices),
  },

  {
    provide: WORK_EVENTS,
    inject: [
      PayloadTypes,
      IntegrationEventMappers,
      EventSubscribers,
      DrizzleLineRepository,
      ID_GENERATOR,
      CLOCK,
      CreateTaskFromProposal,
      ReconcileSetup,
      DrizzleTaskRepository,
      OUTBOUND_TASK_NOTIFIER,
      DrizzleLineRepository,
      DrizzleRunRepository,
      DrizzleChatRepository,
      TASK_DISPATCH,
      CHAT_DISPATCH,
      RUN_USAGE_WRITER,
      TASK_PLACEMENTS,
      TRANSACTION,
      STATION_TALLIES,
      LOGGER,
      RUN_GRANTS,
      RunnerLeases,
      ToolUsedHooks,
      RUN_JOURNAL,
      RUN_USAGES,
      RUN_TOOLS,
      RUN_SPENDS,
      Notices,
      RUN_TOKENS,
    ],
    useFactory: (
      types: PayloadTypes,
      mappers: IntegrationEventMappers,
      subscribers: EventSubscribers,
      seedingLines: DrizzleLineRepository,
      ids: IdGeneratorPort,
      clock: ClockPort,
      acceptances: CreateTaskFromProposal,
      setup: ReconcileSetup,
      tasks: DrizzleTaskRepository,
      notifier: OutboundTaskNotifierPort,
      lines: DrizzleLineRepository,
      runs: DrizzleRunRepository,
      chats: DrizzleChatRepository,
      taskDispatch: DispatchTask,
      chatDispatch: DispatchChat,
      usageWriter: RunUsageWriterPort,
      placements: TaskPlacementsPort,
      transaction: TransactionPort,
      tallies: StationTalliesPort,
      logger: LoggerPort,
      runGrants: RunGrantsPort,
      ending: RunnerLeases,
      toolUsedHooks: ToolUsedHooks,
      journal: RunJournalPort,
      usages: RunUsageReaderPort,
      tools: RunToolsReaderPort,
      spends: RunSpendReaderPort,
      notices: Notices,
      runTokens: RunTokensPort,
    ) => {
      types.register('work', WORK_PAYLOAD_TYPES);
      mappers.register(WORK_EVENT_MAPPERS);
      subscribers.register([
        ...workSubscribers({
          handOver: new HandOver(
            tasks,
            runs,
            placements,
            lines,
            taskDispatch,
            clock,
          ),
          pausedRuns: new PausedRuns(tasks, runs),
          pauseMarks: new PauseMarks(journal),
          chatOutcomes: new ChatOutcomes(chats, chatDispatch),
          usages: new RecordRunUsage(usageWriter, usages, tools, spends),
          seeding: new SeedTeam(
            seedingLines,
            tasks,
            ids,
            clock,
            DEFAULT_HARNESS,
          ),
          acceptances,
          outsideTools: new NotifyOutsideTools(tasks, notifier, transaction),
          taskRuns: new EnqueueTaskRun(tasks, lines, runs, taskDispatch),
          detachedRuns: new CancelDetachedRun(runs, clock),
          chatRuns: new EnqueueChatRun(chats, runs, chatDispatch),
          setup,
          deleting: new DeleteTeamLines(lines, tallies, transaction, logger),
          runGrants,
          runTokens,
          runners: ending,
          toolUsedHooks,
          notices,
          connections: new ConnectionsMade(tasks, clock),
        }),
      ]);
      return true;
    },
  },

  ...bindQueryHandler(ListLinesQuery, ListLinesHandler, [LINE_READER]),

  ...bindQueryHandler(ListTasksQuery, ListTasksHandler, [TASK_READER]),

  ...bindQueryHandler(ListTaskRunsQuery, ListTaskRunsHandler, [RUN_READER]),

  ...bindQueryHandler(ListTeamRunsQuery, ListTeamRunsHandler, [RUN_READER]),

  ...bindQueryHandler(ReadRunConfigQuery, ReadRunConfigHandler, [
    WORKSPACE_ACCESS,
    RUN_READER,
  ]),

  ...bindQueryHandler(ReadRunNetworkQuery, ReadRunNetworkHandler, [
    RUN_EVENT_READER,
    RUN_CONNECTIONS,
  ]),

  ...bindQueryHandler(ReadSearchRunQuery, ReadSearchRunHandler, [
    WORKSPACE_ACCESS,
    RUN_READER,
    RUN_JOURNAL_READER,
    RUN_USAGES,
    RUN_SPENDS,
    SEARCH_AGENTS,
  ]),

  ...bindQueryHandler(ReadReplayRunQuery, ReadReplayRunHandler, [
    WORKSPACE_ACCESS,
    RUN_READER,
    RUN_JOURNAL_READER,
    RUN_USAGES,
  ]),

  ...bindQueryHandler(ReadRunNotesQuery, ReadRunNotesHandler, [
    RUN_READER,
    RUN_USAGES,
  ]),

  ...bindQueryHandler(ReadAttachmentQuery, ReadAttachmentHandler, [
    WORKSPACE_READER,
    ATTACHMENT_READER,
    ATTACHMENT_STORE,
  ]),

  ...bindQueryHandler(ReadRunAttachmentQuery, ReadRunAttachmentHandler, [
    RunWorks,
    ATTACHMENT_STORE,
  ]),

  {
    provide: WORKSPACE_ARCHIVE_STORE,
    inject: [ENV],
    useFactory: (env: Env) => new S3WorkspaceArchiveStore(env),
  },

  ...bindQueryHandler(
    StoredWorkspaceArchiveQuery,
    StoredWorkspaceArchiveHandler,
    [
      DrizzleRunRepository,
      DrizzleWorkspaceArchiveRepository,
      WORKSPACE_ARCHIVE_STORE,
    ],
  ),

  ...bindCommandHandler(
    GrantWorkspaceArchiveCommand,
    GrantWorkspaceArchiveHandler,
    [
      DrizzleRunRepository,
      DrizzleWorkspaceArchiveRepository,
      WORKSPACE_ARCHIVE_STORE,
      ID_GENERATOR,
      CLOCK,
    ],
  ),

  ...bindCommandHandler(
    RecordStartingPointCommand,
    RecordStartingPointHandler,
    [
      DrizzleRunRepository,
      DrizzleWorkspaceArchiveRepository,
      RUNNER_HEARTBEATS,
      CLOCK,
    ],
  ),

  ...bindCommandHandler(
    CompleteWorkspaceArchiveCommand,
    CompleteWorkspaceArchiveHandler,
    [
      DrizzleRunRepository,
      DrizzleWorkspaceArchiveRepository,
      WORKSPACE_ARCHIVE_STORE,
      CLOCK,
    ],
  ),

  {
    provide: RemoveReleasedArchives,
    inject: [
      ARCHIVE_REFERENCES,
      DrizzleWorkspaceArchiveRepository,
      WORKSPACE_ARCHIVE_STORE,
      CLOCK,
      LOGGER,
    ],
    useFactory: (
      references: ArchiveReferencesPort,
      archives: DrizzleWorkspaceArchiveRepository,
      store: WorkspaceArchiveStorePort,
      clock: ClockPort,
      logger: LoggerPort,
    ) => new RemoveReleasedArchives(references, archives, store, clock, logger),
  },

  {
    provide: WorkspaceArchivesWorker,
    inject: [RemoveReleasedArchives, LOGGER],
    useFactory: (released: RemoveReleasedArchives, logger: LoggerPort) =>
      new WorkspaceArchivesWorker(released, logger),
  },

  ...bindQueryHandler(PendingMessagesQuery, PendingMessagesHandler, [
    DrizzleRunRepository,
    LEASED_RUN_READER,
  ]),

  ...bindQueryHandler(ListChatsQuery, ListChatsHandler, [
    WORKSPACE_READER,
    CHAT_READER,
  ]),

  ...bindQueryHandler(ReadChatQuery, ReadChatHandler, [CHAT_READER]),

  ...bindQueryHandler(ReadChatJournalQuery, ReadChatJournalHandler, [
    RUN_JOURNAL_READER,
  ]),

  ...bindQueryHandler(RunStopRequestedQuery, RunStopRequestedHandler, [
    LEASED_RUN_READER,
  ]),

  ...bindQueryHandler(TurnAwaitsPersonQuery, TurnAwaitsPersonHandler, [
    DrizzleRunRepository,
    DrizzleTaskRepository,
    DrizzleLineRepository,
    LIFECYCLE_HOOKS,
  ]),

  ...bindQueryHandler(ListHarnessesQuery, ListHarnessesHandler, [
    HARNESS_LAUNCH,
    WORKSPACE_ACCESS,
    RUNNER_READER,
  ]),

  ...bindQueryHandler(HarnessCatalogueQuery, HarnessCatalogueHandler, [
    HARNESS_LAUNCH,
  ]),

  ...bindQueryHandler(HostRequirementsQuery, HostRequirementsHandler, [
    HARNESS_LAUNCH,
    RUNNER_AUTHENTICATOR,
    LINE_IMAGES,
    CONTROL_PLANE_RELEASE,
  ]),

  ...bindQueryHandler(PoolQueueQuery, PoolQueueHandler, [
    RUNNER_POOLS,
    QUEUED_PLACEMENTS,
    CHECK_WORK,
    CLOCK,
  ]),

  { provide: QUEUED_PLACEMENTS, useClass: DrizzleQueuedPlacements },

  {
    provide: RunnerLeases,
    inject: [RUNNERS, CLOCK],
    useFactory: (runners: RunnersPort, clock: ClockPort) =>
      new RunnerLeases(runners, clock),
  },

  { provide: CHECK_ENDINGS, useExisting: RunnerLeases },

  {
    provide: ProvisionFailures,
    inject: [DrizzleRunRepository, RUN_JOURNAL, RUN_STREAM],
    useFactory: (
      runs: DrizzleRunRepository,
      journal: RunJournalPort,
      stream: RunStreamPort,
    ) => new ProvisionFailures(runs, journal, stream),
  },

  {
    provide: ProvisionWork,
    inject: [
      DrizzleRunRepository,
      CHECK_PROVISIONING,
      RUNNER_POOLS,
      RUNNERS,
      ProvisionFailures,
      ID_GENERATOR,
      CLOCK,
      LOGGER,
    ],
    useFactory: (
      runs: DrizzleRunRepository,
      checks: CheckProvisioningPort,
      pools: RunnerPoolsPort,
      runners: RunnersPort,
      failures: ProvisionFailures,
      ids: IdGeneratorPort,
      clock: ClockPort,
      logger: LoggerPort,
    ) =>
      new ProvisionWork(
        runs,
        checks,
        pools,
        runners,
        failures,
        ids,
        clock,
        logger,
      ),
  },

  {
    provide: ProvisionWorkWorker,
    inject: [ProvisionWork, LOGGER],
    useFactory: (work: ProvisionWork, logger: LoggerPort) =>
      new ProvisionWorkWorker(work, logger),
  },

  ...bindQueryHandler(ListInboxQuery, ListInboxHandler, [INBOX_READER, CLOCK]),

  ...bindQueryHandler(ListRunnerActivityQuery, ListRunnerActivityHandler, [
    WORKSPACE_ACCESS,
    RUNNER_ACTIVITY_READER,
  ]),

  ...bindQueryHandler(ReadTaskTraceQuery, ReadTaskTraceHandler, [
    RUN_READER,
    RUN_JOURNAL_READER,
    RUN_CONNECTIONS,
  ]),

  ...bindQueryHandler(ReadRunnerHistoryQuery, ReadRunnerHistoryHandler, [
    RUNNER_TRACE_READER,
    STATION_RUN_READER,
    RUN_OUTCOMES,
    RUN_USAGES,
    SEARCH_VISIBILITY,
    RUN_CONNECTIONS,
  ]),

  ...bindQueryHandler(ReadRunnerTraceQuery, ReadRunnerTraceHandler, [
    RUNNER_TRACE_READER,
    SEARCH_VISIBILITY,
    RUN_CONNECTIONS,
  ]),

  ...bindQueryHandler(ReadTaskJournalQuery, ReadTaskJournalHandler, [
    RUN_JOURNAL_READER,
  ]),

  ...bindQueryHandler(WatchRunQuery, WatchRunHandler, [RUN_EVENT_READER]),

  ...bindQueryHandler(ReadRunEventsQuery, ReadRunEventsHandler, [
    RUN_EVENT_READER,
  ]),

  ...bindCommandHandler(AddTaskCommand, AddTaskHandler, [
    TASK_PLACEMENTS,
    LineLoader,
    ID_GENERATOR,
    CLOCK,
    CreateTask,
    FilesLoader,
    TASK_READER,
  ]),

  ...bindCommandHandler(
    GrantAttachmentUploadCommand,
    GrantAttachmentUploadHandler,
    [WORKSPACE_READER, ATTACHMENT_STORE, ID_GENERATOR],
  ),

  ...bindCommandHandler(CreateLineCommand, CreateLineHandler, [
    WORKSPACE_ACCESS,
    TEAM_DIRECTORY,
    LINE_COMPILER,
    ApplyLines,
    IDEMPOTENT_CREATES,
    TRANSACTION,
    StationCatalog,
  ]),

  ...bindCommandHandler(UpdateLineCommand, UpdateLineHandler, [
    WORKSPACE_ACCESS,
    LINE_COMPILER,
    DrizzleLineRepository,
    ApplyLines,
    TRANSACTION,
    StationCatalog,
  ]),

  ...bindCommandHandler(DeleteLineCommand, DeleteLineHandler, [
    WORKSPACE_ACCESS,
    DrizzleLineRepository,
    STATION_TALLIES,
    TRANSACTION,
  ]),

  ...bindQueryHandler(ReadLineQuery, ReadLineHandler, [
    WORKSPACE_ACCESS,
    LINE_RESOURCES,
    LineViews,
  ]),

  ...bindQueryHandler(ImportLineQuery, ImportLineHandler, [
    WORKSPACE_ACCESS,
    TEAM_DIRECTORY,
    LINE_RESOURCES,
    LineViews,
  ]),
  ...bindQueryHandler(ListLineResourcesQuery, ListLineResourcesHandler, [
    WORKSPACE_ACCESS,
    TEAM_DIRECTORY,
    LINE_RESOURCES,
    LineViews,
  ]),

  ...bindCommandHandler(DeleteTaskCommand, DeleteTaskHandler, [
    DrizzleTaskRepository,
    LineLoader,
  ]),

  ...bindCommandHandler(AnswerInboxItemCommand, AnswerInboxItemHandler, [
    ConversationLoader,
    DrizzleTaskRepository,
    TASK_DISPATCH,
    TRANSACTION,
    CLOCK,
    FilesLoader,
    DraftSending,
  ]),

  ...bindQueryHandler(JoinTaskDraftQuery, JoinTaskDraftHandler, [
    TASK_WORKSPACES,
    WORKSPACE_ACCESS,
  ]),

  ...bindQueryHandler(ReadTaskDraftQuery, ReadTaskDraftHandler, [
    TASK_DRAFT_STATES,
  ]),

  ...bindCommandHandler(KeepTaskDraftCommand, KeepTaskDraftHandler, [
    TASK_DRAFT_STATES,
  ]),

  ...bindQueryHandler(OnboardingQuery, OnboardingHandler, [
    WORKSPACE_READER,
    WORKSPACE_ACCESS,
    SetupStatus,
    TEAM_PROVISIONING,
  ]),

  ...bindCommandHandler(
    MarkInboxRequestReadCommand,
    MarkInboxRequestReadHandler,
    [InboxRequestLoader, DrizzleInboxRequestRepository, CLOCK],
  ),
  ...bindCommandHandler(ResolveNoticeCommand, ResolveNoticeHandler, [
    NoticeLoader,
    DrizzleNoticeRepository,
    CLOCK,
  ]),
  ...bindCommandHandler(MarkInboxItemReadCommand, MarkInboxItemReadHandler, [
    ConversationLoader,
    DrizzleTaskRepository,
    CLOCK,
  ]),

  {
    provide: OpenPullRequest,
    inject: [
      DrizzleTaskRepository,
      DrizzleLineRepository,
      PULL_REQUESTS,
      TRANSACTION,
      TASK_VIEWS,
      LIFECYCLE_HOOKS,
      CLOCK,
    ],
    useFactory: (
      tasks: DrizzleTaskRepository,
      lines: DrizzleLineRepository,
      pullRequests: PullRequestPort,
      transaction: TransactionPort,
      taskViews: TaskViewsPort,
      hooks: LifecycleHooksPort,
      clock: ClockPort,
    ) =>
      new OpenPullRequest(
        tasks,
        lines,
        pullRequests,
        transaction,
        taskViews,
        hooks,
        clock,
      ),
  },

  {
    provide: BUILT_IN_TOOL_USES,
    inject: [
      OpenPullRequest,
      DrizzleChatRepository,
      DrizzleLineRepository,
      CLOCK,
      PULL_REQUEST_REVIEWING,
      PULL_REQUESTS,
      TRANSACTION,
    ],
    useFactory: (
      opening: OpenPullRequest,
      chats: DrizzleChatRepository,
      lines: DrizzleLineRepository,
      clock: ClockPort,
      reviewing: PullRequestReviewingPort,
      pullRequests: PullRequestPort,
      transaction: TransactionPort,
    ): readonly BuiltInToolUse[] => [
      new PullRequestToolUse(opening),
      new ProposeTaskToolUse(chats, lines, clock),
      new SetupPullRequestToolUse(chats, pullRequests, transaction, clock),
      new ReviewCommentToolUse(reviewing),
      new ReviewToolUse(reviewing),
    ],
  },

  {
    provide: BuiltInTools,
    inject: [BUILT_IN_TOOL_USES],
    useFactory: (uses: readonly BuiltInToolUse[]) => new BuiltInTools(uses),
  },

  {
    provide: INTEGRATION_TOOLS,
    inject: [
      DrizzleTaskRepository,
      DrizzleLineRepository,
      IntegrationTaskViews,
      INTEGRATION_TOOL_CALLS,
      RunWorks,
    ],
    useFactory: (
      tasks: DrizzleTaskRepository,
      lines: DrizzleLineRepository,
      taskViews: IntegrationTaskViews,
      calls: IntegrationToolCallsPort,
      works: RunWorks,
    ) => new IntegrationTools(tasks, lines, taskViews, calls, works),
  },

  ...bindCommandHandler(UseToolCommand, UseToolHandler, [
    RunWorks,
    ToolSources,
    TASK_VIEWS,
    LIFECYCLE_HOOKS,
    ID_GENERATOR,
    DOMAIN_EVENT_DISPATCHER,
  ]),

  {
    provide: ToolUsedHooks,
    inject: [TASK_VIEWS, LIFECYCLE_HOOKS],
    useFactory: (taskViews: TaskViewsPort, hooks: LifecycleHooksPort) =>
      new ToolUsedHooks(taskViews, hooks),
  },

  ...bindCommandHandler(AskPermissionCommand, AskPermissionHandler, [
    RunWorks,
    HARNESS_TOOL_NAMES,
  ]),

  ...bindCommandHandler(StartChatCommand, StartChatHandler, [
    WORKSPACE_READER,
    WORKSPACE_ACCESS,
    DrizzleChatRepository,
    FilesLoader,
    TracesLoader,
    DrizzleLineRepository,
    CHAT_DISPATCH,
    HARNESS_LAUNCH,
    ACCESSIBLE_REPOSITORIES,
    RUNNER_READER,
    CiSetups,
    ID_GENERATOR,
    CLOCK,
    TRANSACTION,
  ]),

  ...bindCommandHandler(SendChatMessageCommand, SendChatMessageHandler, [
    ChatLoader,
    DrizzleChatRepository,
    FilesLoader,
    TracesLoader,
    CHAT_DISPATCH,
    CLOCK,
    TRANSACTION,
  ]),

  ...bindCommandHandler(StopChatCommand, StopChatHandler, [
    ChatLoader,
    DrizzleRunRepository,
    CLOCK,
  ]),

  ...bindCommandHandler(AcceptProposalCommand, AcceptProposalHandler, [
    ChatLoader,
    DrizzleChatRepository,
    CLOCK,
  ]),

  ...bindCommandHandler(DismissProposalCommand, DismissProposalHandler, [
    ChatLoader,
    DrizzleChatRepository,
    CLOCK,
  ]),

  ...bindCommandHandler(
    ReplyToReviewCommentCommand,
    ReplyToReviewCommentHandler,
    [
      RunLoader,
      DrizzleTaskRepository,
      DrizzleLineRepository,
      REVIEW_COMMENTS,
      CLOCK,
    ],
  ),

  ...bindCommandHandler(SendMessageCommand, SendMessageHandler, [
    DrizzleRunRepository,
    DrizzleTaskRepository,
    DrizzleLineRepository,
    TRANSACTION,
    TASK_DISPATCH,
    CLOCK,
    FilesLoader,
    WORKSPACE_ACCESS,
    DraftSending,
  ]),

  ...bindCommandHandler(StopRunCommand, StopRunHandler, [
    DrizzleRunRepository,
    DrizzleTaskRepository,
    CLOCK,
  ]),

  ...bindCommandHandler(AckMessagesCommand, AckMessagesHandler, [
    RunWorks,
    CLOCK,
  ]),

  ...bindCommandHandler(MoveTaskCommand, MoveTaskHandler, [
    DrizzleTaskRepository,
    TASK_PLACEMENTS,
    LineLoader,
    TRANSACTION,
    TASK_DISPATCH,
    CLOCK,
    TASK_READER,
  ]),

  ...bindCommandHandler(AssignTaskCommand, AssignTaskHandler, [
    DrizzleTaskRepository,
    TEAM_DIRECTORY,
    TRANSACTION,
    TASK_READER,
    DrizzleLineRepository,
  ]),

  ...bindCommandHandler(ClaimRunCommand, ClaimRunHandler, [
    DrizzleRunRepository,
    RunLeases,
    RUNNER_HEARTBEATS,
    CLOCK,
    CHECK_WORK,
    ClaimsTaken,
    ProvisionFailures,
    RunStartHooks,
    LongPoll,
  ]),

  ...bindCommandHandler(ClaimHostWorkCommand, ClaimHostWorkHandler, [
    RUNNER_AUTHENTICATOR,
    RUNNERS,
    RUNNER_HEARTBEATS,
    DrizzleRunRepository,
    RunLeases,
    CHECK_WORK,
    CLOCK,
    RunStartHooks,
    ClaimsTaken,
    LongPoll,
  ]),

  ...bindCommandHandler(ClaimHostCallCommand, ClaimHostCallHandler, [
    RUNNER_AUTHENTICATOR,
    RUNNERS,
    DrizzleNetworkCallRepository,
    CLOCK,
    LongPoll,
  ]),

  ...bindCommandHandler(
    RecordHostCallResponseCommand,
    RecordHostCallResponseHandler,
    [RUNNER_AUTHENTICATOR, DrizzleNetworkCallRepository, CLOCK],
  ),

  {
    provide: EgressSecretFetches,
    inject: [
      DrizzleRunRepository,
      RUN_SECRET_FETCHES,
      RUN_GRANTS,
      SANDBOX_HOSTS,
      DrizzleChatRepository,
      RUN_TOKENS,
      CLOCK,
      CONTROL_PLANE_HOST,
    ],
    useFactory: (
      runs: DrizzleRunRepository,
      runSecretFetches: RunSecretFetchesPort,
      grants: RunGrantsPort,
      sandboxHosts: SandboxHostsPort,
      chats: DrizzleChatRepository,
      runTokens: RunTokensPort,
      clock: ClockPort,
      controlPlaneHost: string,
    ) =>
      new EgressSecretFetches(
        runs,
        runSecretFetches,
        grants,
        sandboxHosts,
        chats,
        runTokens,
        clock,
        controlPlaneHost,
      ),
  },

  {
    provide: CONTROL_PLANE_HOST,
    inject: [ENV],
    useFactory: (env: Env) => new URL(publicUrlOf(env)).hostname,
  },

  {
    provide: CONTROL_PLANE_PORT,
    inject: [ENV],
    useFactory: (env: Env) => {
      const url = new URL(publicUrlOf(env));

      return Number(url.port || (url.protocol === 'https:' ? 443 : 80));
    },
  },

  { provide: RUN_CONNECTIONS, useClass: DrizzleRunConnections },

  {
    provide: PurgeRunConnections,
    inject: [RUN_CONNECTIONS, CLOCK],
    useFactory: (connections: RunConnectionsPort, clock: ClockPort) =>
      new PurgeRunConnections(connections, clock),
  },

  {
    provide: RunConnectionsWorker,
    inject: [PurgeRunConnections, LOGGER],
    useFactory: (purging: PurgeRunConnections, logger: LoggerPort) =>
      new RunConnectionsWorker(purging, logger),
  },

  ...bindCommandHandler(FetchRunSecretsCommand, FetchRunSecretsHandler, [
    RUNNER_EGRESS,
    EgressSecretFetches,
    CLOCK,
  ]),

  ...bindCommandHandler(
    FetchSharedRunSecretsCommand,
    FetchSharedRunSecretsHandler,
    [RUNNER_EGRESS, EgressSecretFetches, CLOCK],
  ),

  ...bindCommandHandler(AuthorizeRunnerCommand, AuthorizeRunnerHandler, [
    RUNNER_EGRESS,
    SANDBOX_HOSTS,
    CLOCK,
    CONTROL_PLANE_HOST,
    CONTROL_PLANE_PORT,
  ]),

  ...bindCommandHandler(CheckActiveRunsCommand, CheckActiveRunsHandler, [
    RUNNER_EGRESS,
    EgressSecretFetches,
    CLOCK,
  ]),

  ...bindCommandHandler(
    RecordEgressConnectionsCommand,
    RecordEgressConnectionsHandler,
    [RUNNER_EGRESS, EgressSecretFetches, RUN_CONNECTIONS, CLOCK],
  ),

  ...bindCommandHandler(RenewLeaseCommand, RenewLeaseHandler, [
    DrizzleRunRepository,
    RUNNER_HEARTBEATS,
    CLOCK,
  ]),

  ...bindCommandHandler(SuspendRunCommand, SuspendRunHandler, [
    DrizzleRunRepository,
    TRANSACTION,
    CLOCK,
  ]),

  ...bindCommandHandler(RenewCheckLeaseCommand, RenewCheckLeaseHandler, [
    CHECK_WORK,
    RUNNER_HEARTBEATS,
    CLOCK,
  ]),

  ...bindCommandHandler(RecordRunImageCommand, RecordRunImageHandler, [
    DrizzleRunRepository,
    RUNNER_HEARTBEATS,
    CLOCK,
  ]),

  ...bindCommandHandler(AppendRunJournalCommand, AppendRunJournalHandler, [
    DrizzleRunRepository,
    RUN_JOURNAL,
    RUN_STREAM,
  ]),

  ...bindCommandHandler(CompleteRunCommand, CompleteRunHandler, [
    DrizzleRunRepository,
    DrizzleTaskRepository,
    DrizzleLineRepository,
    TRANSACTION,
    TASK_VIEWS,
    LIFECYCLE_HOOKS,
    CLOCK,
    RUN_JOURNAL_READER,
  ]),

  ...bindCommandHandler(EnqueueRunCommand, EnqueueRunHandler, [
    DrizzleRunRepository,
    ID_GENERATOR,
    HARNESS_LAUNCH,
    WORKSPACE_ACCESS,
  ]),

  // RunnerGuard must run before AuthenticatedGuard.
  { provide: APP_GUARD, useClass: RunnerGuard },

  { provide: APP_GUARD, useClass: AuthenticatedGuard },
];
