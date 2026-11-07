import {
  CATALOG,
  type CatalogPort,
} from '@catalog/application/ports/catalog.port';
import {
  CHECK_RUNS,
  type CheckRunsPort,
} from '@github/application/ports/check-runs.port';
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
import { LINE_IMAGES } from '@lines/application/ports/line-images.port';
import {
  LINE_RESOURCES,
  type LineResourcesPort,
} from '@lines/application/ports/line-resources.port';
import { LINES, type LinesPort } from '@lines/application/ports/lines.port';
import { SEEDING_HARNESS } from '@lines/application/ports/seeding-harness.port';
import { STATION_HOLDERS } from '@lines/application/ports/station-holders.port';
import type { Provider, Type } from '@nestjs/common';
import { ENV } from '@platform/config/config.constants';
import { publicUrlOf } from '@platform/config/env';
import type { Env } from '@platform/config/env.schema';
import { bindCommandHandler } from '@platform/cqrs/bind-command-handler';
import { bindQueryHandler } from '@platform/cqrs/bind-query-handler';
import { EventSubscribers } from '@platform/events/event-subscribers';
import { IntegrationEventMappers } from '@platform/events/integration-event-mappers';
import { PayloadTypes } from '@platform/events/payload-types';
import { ReadinessChecks } from '@platform/health/readiness-checks';
import { CryptoIdGenerator } from '@platform/ids/crypto-id.generator';
import { RedisConnection } from '@platform/redis/redis-connection';
import { s3ClientsOf } from '@platform/storage/s3-clients';
import { EDITOR_LEASES } from '@runners/application/ports/editor-leases.port';
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
  SANDBOXES,
  type SandboxesPort,
} from '@runners/application/ports/sandboxes.port';
import { CALL_SECRET_FETCHES } from '@secrets/application/ports/call-secret-fetches.port';
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
import { TOKEN_ISSUER } from '@shared-kernel/application/ports/token-issuer.port';
import {
  TRANSACTION,
  type TransactionPort,
} from '@shared-kernel/application/ports/transaction.port';
import { AckMessagesCommand } from '@work/application/commands/ack-messages.command';
import { AddTaskCommand } from '@work/application/commands/add-task.command';
import { AnswerConversationCommand } from '@work/application/commands/answer-conversation.command';
import { AskPermissionCommand } from '@work/application/commands/ask-permission.command';
import { AssignTaskCommand } from '@work/application/commands/assign-task.command';
import {
  AcceptProposalCommand,
  DismissProposalCommand,
  SendChatMessageCommand,
  StartChatCommand,
  StopChatCommand,
} from '@work/application/commands/chat.commands';
import { ConnectEditorCommand } from '@work/application/commands/connect-editor.command';
import { DeleteTaskCommand } from '@work/application/commands/delete-task.command';
import {
  FetchRunSecretsCommand,
  FetchSharedRunSecretsCommand,
  RecordEgressConnectionsCommand,
} from '@work/application/commands/egress.commands';
import { GrantAttachmentUploadCommand } from '@work/application/commands/grant-attachment-upload.command';
import { AcceptProposalHandler } from '@work/application/commands/handlers/accept-proposal.handler';
import { AckMessagesHandler } from '@work/application/commands/handlers/ack-messages.handler';
import { AddTaskHandler } from '@work/application/commands/handlers/add-task.handler';
import { AnswerConversationHandler } from '@work/application/commands/handlers/answer-conversation.handler';
import { AppendRunJournalHandler } from '@work/application/commands/handlers/append-run-journal.handler';
import { AskPermissionHandler } from '@work/application/commands/handlers/ask-permission.handler';
import { AssignTaskHandler } from '@work/application/commands/handlers/assign-task.handler';
import { ClaimHostCallHandler } from '@work/application/commands/handlers/claim-host-call.handler';
import { ClaimHostWorkHandler } from '@work/application/commands/handlers/claim-host-work.handler';
import { ClaimRunHandler } from '@work/application/commands/handlers/claim-run.handler';
import { CompleteRunHandler } from '@work/application/commands/handlers/complete-run.handler';
import { CompleteSandboxArchiveHandler } from '@work/application/commands/handlers/complete-sandbox-archive.handler';
import { CompleteWorkspaceArchiveHandler } from '@work/application/commands/handlers/complete-workspace-archive.handler';
import { ConnectEditorHandler } from '@work/application/commands/handlers/connect-editor.handler';
import { DeleteTaskHandler } from '@work/application/commands/handlers/delete-task.handler';
import { DismissProposalHandler } from '@work/application/commands/handlers/dismiss-proposal.handler';
import { EnqueueRunHandler } from '@work/application/commands/handlers/enqueue-run.handler';
import { FetchRunSecretsHandler } from '@work/application/commands/handlers/fetch-run-secrets.handler';
import { FetchSharedRunSecretsHandler } from '@work/application/commands/handlers/fetch-shared-run-secrets.handler';
import { GrantAttachmentUploadHandler } from '@work/application/commands/handlers/grant-attachment-upload.handler';
import { GrantRunAttachmentUploadHandler } from '@work/application/commands/handlers/grant-run-attachment-upload.handler';
import { GrantSandboxArchiveHandler } from '@work/application/commands/handlers/grant-sandbox-archive.handler';
import { GrantWorkspaceArchiveHandler } from '@work/application/commands/handlers/grant-workspace-archive.handler';
import { KeepTaskDraftHandler } from '@work/application/commands/handlers/keep-task-draft.handler';
import { MarkConversationReadHandler } from '@work/application/commands/handlers/mark-conversation-read.handler';
import { MarkInboxRequestReadHandler } from '@work/application/commands/handlers/mark-inbox-request-read.handler';
import { MoveTaskHandler } from '@work/application/commands/handlers/move-task.handler';
import { RecordEgressConnectionsHandler } from '@work/application/commands/handlers/record-egress-connections.handler';
import { RecordHostCallResponseHandler } from '@work/application/commands/handlers/record-host-call-response.handler';
import { RecordRunImageHandler } from '@work/application/commands/handlers/record-run-image.handler';
import { RecordStartingPointHandler } from '@work/application/commands/handlers/record-starting-point.handler';
import { RedeemCallSecretsHandler } from '@work/application/commands/handlers/redeem-call-secrets.handler';
import { RenewCheckLeaseHandler } from '@work/application/commands/handlers/renew-check-lease.handler';
import { RenewLeaseHandler } from '@work/application/commands/handlers/renew-lease.handler';
import { ReopenConversationHandler } from '@work/application/commands/handlers/reopen-conversation.handler';
import { ReopenInboxRequestHandler } from '@work/application/commands/handlers/reopen-inbox-request.handler';
import { ReopenNoticeHandler } from '@work/application/commands/handlers/reopen-notice.handler';
import { ReplyToReviewCommentHandler } from '@work/application/commands/handlers/reply-to-review-comment.handler';
import { ResolveConversationHandler } from '@work/application/commands/handlers/resolve-conversation.handler';
import { ResolveInboxRequestHandler } from '@work/application/commands/handlers/resolve-inbox-request.handler';
import { ResolveNoticeHandler } from '@work/application/commands/handlers/resolve-notice.handler';
import { SendChatMessageHandler } from '@work/application/commands/handlers/send-chat-message.handler';
import { SendMessageHandler } from '@work/application/commands/handlers/send-message.handler';
import { StartChatHandler } from '@work/application/commands/handlers/start-chat.handler';
import { StopChatHandler } from '@work/application/commands/handlers/stop-chat.handler';
import { StopRunHandler } from '@work/application/commands/handlers/stop-run.handler';
import { UseToolHandler } from '@work/application/commands/handlers/use-tool.handler';
import {
  ClaimHostCallCommand,
  RecordHostCallResponseCommand,
  RedeemCallSecretsCommand,
} from '@work/application/commands/host-call.commands';
import { KeepTaskDraftCommand } from '@work/application/commands/keep-task-draft.command';
import { MarkConversationReadCommand } from '@work/application/commands/mark-conversation-read.command';
import { MarkInboxRequestReadCommand } from '@work/application/commands/mark-inbox-request-read.command';
import { MoveTaskCommand } from '@work/application/commands/move-task.command';
import { ReopenConversationCommand } from '@work/application/commands/reopen-conversation.command';
import { ReopenInboxRequestCommand } from '@work/application/commands/reopen-inbox-request.command';
import { ReopenNoticeCommand } from '@work/application/commands/reopen-notice.command';
import { ReplyToReviewCommentCommand } from '@work/application/commands/reply-to-review-comment.command';
import { ResolveConversationCommand } from '@work/application/commands/resolve-conversation.command';
import { ResolveInboxRequestCommand } from '@work/application/commands/resolve-inbox-request.command';
import { ResolveNoticeCommand } from '@work/application/commands/resolve-notice.command';
import {
  AppendRunJournalCommand,
  ClaimHostWorkCommand,
  ClaimRunCommand,
  CompleteRunCommand,
  EnqueueRunCommand,
  GrantRunAttachmentUploadCommand,
  RecordRunImageCommand,
  RecordStartingPointCommand,
  RenewCheckLeaseCommand,
  RenewLeaseCommand,
} from '@work/application/commands/runner.commands';
import { SendMessageCommand } from '@work/application/commands/send-message.command';
import { StopRunCommand } from '@work/application/commands/stop-run.command';
import { UseToolCommand } from '@work/application/commands/use-tool.command';
import {
  CompleteSandboxArchiveCommand,
  CompleteWorkspaceArchiveCommand,
  GrantSandboxArchiveCommand,
  GrantWorkspaceArchiveCommand,
} from '@work/application/commands/workspace-archive.commands';
import { CancelDetachedRun } from '@work/application/events/handlers/cancel-detached-run.handler';
import { ChatOutcomes } from '@work/application/events/handlers/chat-outcomes.handler';
import { CreateTaskFromProposal } from '@work/application/events/handlers/create-task-from-proposal.handler';
import { DeleteTaskDraft } from '@work/application/events/handlers/delete-task-draft.handler';
import { DeleteTaskInboxRequests } from '@work/application/events/handlers/delete-task-inbox-requests.handler';
import { DeleteTeamChats } from '@work/application/events/handlers/delete-team-chats.handler';
import { DispatchRunEndings } from '@work/application/events/handlers/dispatch-run-endings.handler';
import { DropUnorderedRun } from '@work/application/events/handlers/drop-unordered-run.handler';
import { EnqueueOrderedRun } from '@work/application/events/handlers/enqueue-ordered-run.handler';
import { HandOver } from '@work/application/events/handlers/hand-over.handler';
import { NotifyChannel } from '@work/application/events/handlers/notify-channel.handler';
import { NotifyOutsideTools } from '@work/application/events/handlers/notify-outside-tools.handler';
import { OrderChatRun } from '@work/application/events/handlers/order-chat-run.handler';
import { OrderTaskRun } from '@work/application/events/handlers/order-task-run.handler';
import { RecordRunUsage } from '@work/application/events/handlers/record-run-usage.handler';
import { ReleaseTakenMarks } from '@work/application/events/handlers/release-taken-marks.handler';
import { WelcomeTeam } from '@work/application/events/handlers/welcome-team.handler';
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
  CHANNEL_NOTICES,
  type ChannelNoticesPort,
} from '@work/application/ports/channel-notices.port';
import {
  CHAT_MARKS,
  type ChatMarksPort,
} from '@work/application/ports/chat-marks.port';
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
import { CONNECTION_ASKS } from '@work/application/ports/connection-asks.port';
import {
  CONTENT_HASH,
  type ContentHashPort,
} from '@work/application/ports/content-hash.port';
import {
  CONTROL_PLANE_RELEASE,
  type ControlPlaneReleasePort,
} from '@work/application/ports/control-plane-release.port';
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
  LINE_MAPS,
  type LineMapsPort,
} from '@work/application/ports/line-maps.port';
import {
  LIVE_TASK_DRAFTS,
  type LiveTaskDraftsPort,
} from '@work/application/ports/live-task-drafts.port';
import {
  MEMORIES_BRIEFED_BEFORE,
  type MemoriesBriefedBeforePort,
} from '@work/application/ports/memories-briefed-before.port';
import { NETWORK_CALLS } from '@work/application/ports/network-calls.port';
import { NOTE_FILES } from '@work/application/ports/note-files.port';
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
import {
  RUN_FACTS,
  type RunFactsPort,
} from '@work/application/ports/run-facts.port';
import type { RunJournalPort } from '@work/application/ports/run-journal.port';
import { RUN_JOURNAL } from '@work/application/ports/run-journal.port';
import {
  RUN_JOURNAL_READER,
  type RunJournalReaderPort,
} from '@work/application/ports/run-journal-reader.port';
import {
  RUN_LEASES,
  type RunLeasesPort,
} from '@work/application/ports/run-leases.port';
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
import { RUN_VIEWERS } from '@work/application/ports/run-viewers.port';
import { RUNNER_ACTIVITY_READER } from '@work/application/ports/runner-activity-reader.port';
import { RUNNER_TRACE_READER } from '@work/application/ports/runner-trace-reader.port';
import { RUNS, type RunsPort } from '@work/application/ports/runs.port';
import {
  SANDBOX_HOSTS,
  type SandboxHostsPort,
} from '@work/application/ports/sandbox-hosts.port';
import { SEARCH_DISPATCH } from '@work/application/ports/search-dispatch.port';
import { SEARCH_RUNS } from '@work/application/ports/search-runs.port';
import { SEARCH_VISIBILITY } from '@work/application/ports/search-visibility.port';
import { STARTING_POINT_HOLDS } from '@work/application/ports/starting-point-holds.port';
import {
  STATION_CHANGE_TESTS,
  type StationChangeTestsPort,
} from '@work/application/ports/station-change-tests.port';
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
  TASK_DECISIONS,
  type TaskDecisionsPort,
} from '@work/application/ports/task-decisions.port';
import {
  TASK_DRAFT_STATES,
  type TaskDraftStatesPort,
} from '@work/application/ports/task-draft-states.port';
import {
  TASK_LINKS,
  type TaskLinksPort,
} from '@work/application/ports/task-links.port';
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
import {
  TEAM_SKILLS,
  type TeamSkillsPort,
} from '@work/application/ports/team-skills.port';
import {
  TEAM_WELCOMES,
  type TeamWelcomesPort,
} from '@work/application/ports/team-welcomes.port';
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
  ListChatJournalRunsQuery,
  ListChatsQuery,
  ReadChatJournalQuery,
  ReadChatQuery,
} from '@work/application/queries/chat.queries';
import {
  ActiveRunsQuery,
  AuthorizeRunnerQuery,
} from '@work/application/queries/egress.queries';
import { ActiveRunsHandler } from '@work/application/queries/handlers/active-runs.handler';
import { AuthorizeRunnerHandler } from '@work/application/queries/handlers/authorize-runner.handler';
import { HostRequirementsHandler } from '@work/application/queries/handlers/host-requirements.handler';
import { JoinTaskDraftHandler } from '@work/application/queries/handlers/join-task-draft.handler';
import { ListChatJournalRunsHandler } from '@work/application/queries/handlers/list-chat-journal-runs.handler';
import { ListChatsHandler } from '@work/application/queries/handlers/list-chats.handler';
import {
  HarnessCatalogueHandler,
  ListHarnessesHandler,
} from '@work/application/queries/handlers/list-harnesses.handler';
import {
  ListInboxHandler,
  ReadInboxItemHandler,
  ReadInboxNoticeHandler,
} from '@work/application/queries/handlers/list-inbox.handler';
import { ListRunnerActivityHandler } from '@work/application/queries/handlers/list-runner-activity.handler';
import { ListTaskJournalRunsHandler } from '@work/application/queries/handlers/list-task-journal-runs.handler';
import { ListTaskRunsHandler } from '@work/application/queries/handlers/list-task-runs.handler';
import {
  ListTasksHandler,
  ReadTaskHandler,
} from '@work/application/queries/handlers/list-tasks.handler';
import {
  ListTeamRunsHandler,
  ReadTeamRunHandler,
} from '@work/application/queries/handlers/list-team-runs.handler';
import { OnboardingHandler } from '@work/application/queries/handlers/onboarding.handler';
import { PendingMessagesHandler } from '@work/application/queries/handlers/pending-messages.handler';
import { PoolQueueHandler } from '@work/application/queries/handlers/pool-queue.handler';
import { ReadAttachmentHandler } from '@work/application/queries/handlers/read-attachment.handler';
import { ReadChatHandler } from '@work/application/queries/handlers/read-chat.handler';
import { ReadChatJournalHandler } from '@work/application/queries/handlers/read-chat-journal.handler';
import { ReadRunAttachmentHandler } from '@work/application/queries/handlers/read-run-attachment.handler';
import { ReadRunConfigHandler } from '@work/application/queries/handlers/read-run-config.handler';
import { ReadRunEventsHandler } from '@work/application/queries/handlers/read-run-events.handler';
import { ReadRunNetworkHandler } from '@work/application/queries/handlers/read-run-network.handler';
import { ReadRunNotesHandler } from '@work/application/queries/handlers/read-run-notes.handler';
import { ReadRunnerHistoryHandler } from '@work/application/queries/handlers/read-runner-history.handler';
import { ReadRunnerTraceHandler } from '@work/application/queries/handlers/read-runner-trace.handler';
import { ReadTaskDraftHandler } from '@work/application/queries/handlers/read-task-draft.handler';
import { ReadTaskJournalHandler } from '@work/application/queries/handlers/read-task-journal.handler';
import { ReadTaskTraceHandler } from '@work/application/queries/handlers/read-task-trace.handler';
import { RunStopRequestedHandler } from '@work/application/queries/handlers/run-stop-requested.handler';
import { StoredSandboxArchiveHandler } from '@work/application/queries/handlers/stored-sandbox-archive.handler';
import { StoredWorkspaceArchiveHandler } from '@work/application/queries/handlers/stored-workspace-archive.handler';
import { WatchRunHandler } from '@work/application/queries/handlers/watch-run.handler';
import { HostRequirementsQuery } from '@work/application/queries/host.queries';
import {
  HarnessCatalogueQuery,
  ListHarnessesQuery,
} from '@work/application/queries/list-harnesses.query';
import {
  ListInboxQuery,
  ReadInboxItemQuery,
  ReadInboxNoticeQuery,
} from '@work/application/queries/list-inbox.query';
import { ListRunnerActivityQuery } from '@work/application/queries/list-runner-activity.query';
import { ListTaskRunsQuery } from '@work/application/queries/list-task-runs.query';
import {
  ListTasksQuery,
  ReadTaskQuery,
} from '@work/application/queries/list-tasks.query';
import {
  ListTeamRunsQuery,
  ReadTeamRunQuery,
} from '@work/application/queries/list-team-runs.query';
import { OnboardingQuery } from '@work/application/queries/onboarding.query';
import { PendingMessagesQuery } from '@work/application/queries/pending-messages.query';
import { PoolQueueQuery } from '@work/application/queries/pool.queries';
import { ReadAttachmentQuery } from '@work/application/queries/read-attachment.query';
import { ReadRunAttachmentQuery } from '@work/application/queries/read-run-attachment.query';
import { ReadRunConfigQuery } from '@work/application/queries/read-run-config.query';
import { ReadRunEventsQuery } from '@work/application/queries/read-run-events.query';
import { ReadRunNetworkQuery } from '@work/application/queries/read-run-network.query';
import { ReadRunNotesQuery } from '@work/application/queries/read-run-notes.query';
import { ReadRunnerHistoryQuery } from '@work/application/queries/read-runner-history.query';
import { ReadRunnerTraceQuery } from '@work/application/queries/read-runner-trace.query';
import {
  ListTaskJournalRunsQuery,
  ReadTaskJournalQuery,
} from '@work/application/queries/read-task-journal.query';
import { ReadTaskTraceQuery } from '@work/application/queries/read-task-trace.query';
import { RunStopRequestedQuery } from '@work/application/queries/run-stop-requested.query';
import {
  StoredSandboxArchiveQuery,
  StoredWorkspaceArchiveQuery,
} from '@work/application/queries/stored-workspace-archive.query';
import {
  JoinTaskDraftQuery,
  ReadTaskDraftQuery,
} from '@work/application/queries/task-draft.queries';
import { WatchRunQuery } from '@work/application/queries/watch-run.query';
import { AttachmentCopies } from '@work/application/services/attachment-copies';
import {
  BUILT_IN_TOOL_USES,
  BuiltInTools,
  type BuiltInToolUse,
} from '@work/application/services/built-in-tools.service';
import { CandidateLines } from '@work/application/services/candidate-lines.service';
import { CarryGitCall } from '@work/application/services/carry-git-call.service';
import { ChannelChats } from '@work/application/services/channel-chats.service';
import {
  CHAT_DISPATCH,
  type ChatDispatching,
} from '@work/application/services/chat-dispatch';
import { ChatLoader } from '@work/application/services/chat-loader.service';
import { ChecksToolUse } from '@work/application/services/checks.tool-use';
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
import { LongPoll } from '@work/application/services/long-poll';
import { NetworkCalls } from '@work/application/services/network-calls.service';
import { NoteFiles } from '@work/application/services/note-files.service';
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
import { RunAccess } from '@work/application/services/run-access.service';
import { RunCatalog } from '@work/application/services/run-catalog.service';
import { RunEvidences } from '@work/application/services/run-evidences.service';
import { RunFacts } from '@work/application/services/run-facts.service';
import { RunLeases } from '@work/application/services/run-leases.service';
import { RunLoader } from '@work/application/services/run-loader.service';
import { RunStartHooks } from '@work/application/services/run-start-hooks.service';
import { RunWorks } from '@work/application/services/run-works.service';
import { RunnerLeases } from '@work/application/services/runner-leases.service';
import { Runs } from '@work/application/services/runs.service';
import { SandboxArchives } from '@work/application/services/sandbox-archives.service';
import { SandboxLeases } from '@work/application/services/sandbox-leases.service';
import { SearchRuns } from '@work/application/services/search-runs.service';
import { SetupPullRequestToolUse } from '@work/application/services/setup-pull-request.tool-use';
import { SetupStatus } from '@work/application/services/setup-status.service';
import { StationOrdering } from '@work/application/services/station-ordering';
import { StationRuns } from '@work/application/services/station-runs.service';
import { StationSkills } from '@work/application/services/station-skills.service';
import {
  TASK_DISPATCH,
  type TaskDispatching,
} from '@work/application/services/task-dispatch';
import { TaskNotesFromHooks } from '@work/application/services/task-notes-from-hooks.service';
import { TaskViews } from '@work/application/services/task-views.service';
import { TeamIntegrations } from '@work/application/services/team-integrations.service';
import { TestStationChangeToolUse } from '@work/application/services/test-station-change.tool-use';
import { ToolSources } from '@work/application/services/tool-sources.service';
import { ToolUsedHooks } from '@work/application/services/tool-used-hooks.service';
import { TouchedFiles } from '@work/application/services/touched-files';
import { TracesLoader } from '@work/application/services/traces-loader.service';
import { WorkAccess } from '@work/application/services/work-access.service';
import { WorkLookup } from '@work/application/services/work-lookup.service';
import {
  CHAT_REPOSITORY,
  type ChatRepository,
} from '@work/domain/repositories/chat.repository';
import {
  DISPATCH_REPOSITORY,
  type DispatchRepository,
} from '@work/domain/repositories/dispatch.repository';
import {
  INBOX_REQUEST_REPOSITORY,
  type InboxRequestRepository,
} from '@work/domain/repositories/inbox-request.repository';
import {
  NOTICE_REPOSITORY,
  type NoticeRepository,
} from '@work/domain/repositories/notice.repository';
import {
  TASK_REPOSITORY,
  type TaskRepository,
} from '@work/domain/repositories/task.repository';
import { BUILT_IN_SKILL_KEY_LIST } from '@work/domain/services/built-in-skills';
import { LinesLineMaps } from '@work/infrastructure/acl/lines.adapter';
import { AcpHarnessToolNames } from '@work/infrastructure/acp/harness-tools';
import { DrizzleTaskDraftStates } from '@work/infrastructure/collab/drizzle-task-draft-states';
import { HocuspocusLiveTaskDrafts } from '@work/infrastructure/collab/hocuspocus-live-task-drafts';
import { WORK_PAYLOAD_TYPES } from '@work/infrastructure/events/work-payload-types';
import { GitHubAccessibleRepositories } from '@work/infrastructure/github/github-accessible-repositories';
import {
  BuiltInHarnesses,
  DEFAULT_HARNESS,
} from '@work/infrastructure/harnesses/built-in-harnesses';
import { Sha256ContentHash } from '@work/infrastructure/hashing/sha256-content-hash';
import { CheckedRunJournal } from '@work/infrastructure/journal/checked-run-journal';
import { WebTaskLinks } from '@work/infrastructure/links/web-task-links';
import { DrizzleProcessedEvents } from '@work/infrastructure/persistence/drizzle/ledgers/processed-events.ledger';
import { DrizzleReplayRunClaims } from '@work/infrastructure/persistence/drizzle/ledgers/replay-run-claims.ledger';
import { DrizzleRunConnections } from '@work/infrastructure/persistence/drizzle/ledgers/run-connections.ledger';
import { DrizzleRunJournal } from '@work/infrastructure/persistence/drizzle/ledgers/run-journal.ledger';
import { DrizzleRunUsages } from '@work/infrastructure/persistence/drizzle/ledgers/run-usages.ledger';
import { DrizzleTeamWelcomes } from '@work/infrastructure/persistence/drizzle/ledgers/team-welcomes.ledger';
import { DrizzleWorkStations } from '@work/infrastructure/persistence/drizzle/projections/work-stations.projection';
import { DrizzleArchiveReferences } from '@work/infrastructure/persistence/drizzle/readers/archive-references.reader';
import { DrizzleAttachmentReader } from '@work/infrastructure/persistence/drizzle/readers/attachment.reader';
import { DrizzleBriefedTasks } from '@work/infrastructure/persistence/drizzle/readers/briefed-tasks.reader';
import { DrizzleChatReader } from '@work/infrastructure/persistence/drizzle/readers/chat.reader';
import { DrizzleChatMarks } from '@work/infrastructure/persistence/drizzle/readers/chat-marks.reader';
import { DrizzleInboxReader } from '@work/infrastructure/persistence/drizzle/readers/inbox.reader';
import { DrizzleLeasedRunReader } from '@work/infrastructure/persistence/drizzle/readers/leased-run.reader';
import { DrizzleQueuedPlacements } from '@work/infrastructure/persistence/drizzle/readers/queued-placements.reader';
import { DrizzleReplayFacts } from '@work/infrastructure/persistence/drizzle/readers/replay-facts.reader';
import { DrizzleRunReader } from '@work/infrastructure/persistence/drizzle/readers/run.reader';
import { DrizzleRunEventReader } from '@work/infrastructure/persistence/drizzle/readers/run-event.reader';
import { DrizzleRunJournalReader } from '@work/infrastructure/persistence/drizzle/readers/run-journal.reader';
import { DrizzleRunnerActivityReader } from '@work/infrastructure/persistence/drizzle/readers/runner-activity.reader';
import { DrizzleRunnerTraceReader } from '@work/infrastructure/persistence/drizzle/readers/runner-trace.reader';
import { DrizzleSearchRunFacts } from '@work/infrastructure/persistence/drizzle/readers/search-run-facts.reader';
import { DrizzleStationRunReader } from '@work/infrastructure/persistence/drizzle/readers/station-run.reader';
import { DrizzleTaskReader } from '@work/infrastructure/persistence/drizzle/readers/task.reader';
import { DrizzleTaskPlacements } from '@work/infrastructure/persistence/drizzle/readers/task-placements.reader';
import { DrizzleTaskWorkspaces } from '@work/infrastructure/persistence/drizzle/readers/task-workspaces.reader';
import { DrizzleTracedTaskReader } from '@work/infrastructure/persistence/drizzle/readers/traced-task.reader';
import { DrizzleChatRepository } from '@work/infrastructure/persistence/drizzle/repositories/chat.repository';
import { DrizzleDispatchRepository } from '@work/infrastructure/persistence/drizzle/repositories/dispatch.repository';
import { DrizzleInboxRequestRepository } from '@work/infrastructure/persistence/drizzle/repositories/inbox-request.repository';
import { DrizzleNetworkCallRepository } from '@work/infrastructure/persistence/drizzle/repositories/network-call.repository';
import { DrizzleNoticeRepository } from '@work/infrastructure/persistence/drizzle/repositories/notice.repository';
import { DrizzleRunRepository } from '@work/infrastructure/persistence/drizzle/repositories/run.repository';
import { DrizzleStartingPointHoldRepository } from '@work/infrastructure/persistence/drizzle/repositories/starting-point-hold.repository';
import { DrizzleTaskRepository } from '@work/infrastructure/persistence/drizzle/repositories/task.repository';
import { DrizzleWorkspaceArchiveRepository } from '@work/infrastructure/persistence/drizzle/repositories/workspace-archive.repository';
import { S3AttachmentStore } from '@work/infrastructure/storage/s3-attachment.store';
import { S3Readiness } from '@work/infrastructure/storage/s3-readiness';
import { S3WorkspaceArchiveStore } from '@work/infrastructure/storage/s3-workspace-archive.store';
import { StorageHosts } from '@work/infrastructure/storage/storage-hosts';
import { InMemoryRunStream } from '@work/infrastructure/streaming/in-memory-run-stream';
import { RedisRunStream } from '@work/infrastructure/streaming/redis-run-stream';
import { RunGauges } from '@work/infrastructure/telemetry/run-gauges';
import { HashedTraceParent } from '@work/infrastructure/tracing/hashed-trace-parent';
import { TaskDraftCollab } from '@work/presentation/collab/task-draft.collab';
import { workSubscribers } from '@work/presentation/events/work.subscribers';
import { AttachmentController } from '@work/presentation/http/controllers/attachment.controller';
import { ChatController } from '@work/presentation/http/controllers/chat.controller';
import { EditorConnectionController } from '@work/presentation/http/controllers/editor-connection.controller';
import { EgressController } from '@work/presentation/http/controllers/egress.controller';
import { GitController } from '@work/presentation/http/controllers/git.controller';
import { HarnessController } from '@work/presentation/http/controllers/harness.controller';
import { HostCallSecretsController } from '@work/presentation/http/controllers/host-call-secrets.controller';
import { HostWorkController } from '@work/presentation/http/controllers/host-work.controller';
import { InboxController } from '@work/presentation/http/controllers/inbox.controller';
import { OnboardingController } from '@work/presentation/http/controllers/onboarding.controller';
import { PoolController } from '@work/presentation/http/controllers/pool.controller';
import { RunController } from '@work/presentation/http/controllers/run.controller';
import { RunStreamController } from '@work/presentation/http/controllers/run-stream.controller';
import { RunnerController } from '@work/presentation/http/controllers/runner.controller';
import { RunnerActivityController } from '@work/presentation/http/controllers/runner-activity.controller';
import { SandboxArchiveController } from '@work/presentation/http/controllers/sandbox-archive.controller';
import { TaskController } from '@work/presentation/http/controllers/task.controller';
import { WorkspaceArchiveController } from '@work/presentation/http/controllers/workspace-archive.controller';
import { LongPollShutdown } from '@work/presentation/http/long-poll-shutdown';
import { NetworkCallsWorker } from '@work/presentation/workers/network-calls.worker';
import { ProcessedEventsWorker } from '@work/presentation/workers/processed-events.worker';
import { ProvisionWorkWorker } from '@work/presentation/workers/provision-work.worker';
import { RunConnectionsWorker } from '@work/presentation/workers/run-connections.worker';
import { RunLeasesWorker } from '@work/presentation/workers/run-leases.worker';
import { WorkspaceArchivesWorker } from '@work/presentation/workers/workspace-archives.worker';

const WORK_EVENTS = Symbol('WORK_EVENTS');

const CONTROL_PLANE_HOST = Symbol('CONTROL_PLANE_HOST');

const CONTROL_PLANE_PORT = Symbol('CONTROL_PLANE_PORT');

export const WORK_CONTROLLERS: readonly Type[] = [
  RunController,
  RunStreamController,
  RunnerController,
  WorkspaceArchiveController,
  SandboxArchiveController,
  PoolController,
  HostWorkController,
  HostCallSecretsController,
  EgressController,
  RunnerActivityController,
  HarnessController,
  InboxController,
  AttachmentController,
  GitController,
  TaskController,
  ChatController,
  EditorConnectionController,
  OnboardingController,
];

export const WORK_PROVIDERS: readonly Provider[] = [
  RunGauges,

  {
    provide: WORK_LOOKUP,
    inject: [
      DrizzleRunRepository,
      TASK_REPOSITORY,
      LINE_MAPS,
      CHAT_REPOSITORY,
      RUN_JOURNAL_READER,
      DISPATCH_REPOSITORY,
    ],
    useFactory: (
      runs: DrizzleRunRepository,
      tasks: TaskRepository,
      lines: LineMapsPort,
      chats: ChatRepository,
      journals: RunJournalReaderPort,
      dispatches: DispatchRepository,
    ) => new WorkLookup(runs, tasks, lines, chats, journals, dispatches),
  },

  {
    provide: CONNECTION_ASKS,
    inject: [TASK_REPOSITORY, LINE_MAPS, CLOCK, TRANSACTION],
    useFactory: (
      tasks: TaskRepository,
      lines: LineMapsPort,
      clock: ClockPort,
      transaction: TransactionPort,
    ) => new ConnectionsMade(tasks, lines, clock, transaction),
  },

  {
    provide: RUN_EVIDENCE,
    inject: [
      RUN_FACTS,
      TASK_REPOSITORY,
      LINE_MAPS,
      RUN_JOURNAL_READER,
      BRIEFED_TASKS,
      CONTENT_HASH,
    ],
    useFactory: (
      runs: RunFactsPort,
      tasks: TaskRepository,
      lines: LineMapsPort,
      journals: RunJournalReaderPort,
      briefed: BriefedTasksPort,
      hash: ContentHashPort,
    ) => new RunEvidences(runs, tasks, lines, journals, briefed, hash),
  },

  DrizzleRunRepository,

  {
    provide: RUNS,
    inject: [DrizzleRunRepository, CONTENT_HASH, CLOCK],
    useFactory: (
      runs: DrizzleRunRepository,
      hash: ContentHashPort,
      clock: ClockPort,
    ) => new Runs(runs, hash, clock),
  },

  {
    provide: RunFacts,
    inject: [DrizzleRunRepository],
    useFactory: (runs: DrizzleRunRepository) => new RunFacts(runs),
  },

  { provide: RUN_FACTS, useExisting: RunFacts },

  { provide: RUN_LEASES, useExisting: RunFacts },

  { provide: PROCESSED_EVENTS, useClass: DrizzleProcessedEvents },

  DrizzleDispatchRepository,

  { provide: DISPATCH_REPOSITORY, useExisting: DrizzleDispatchRepository },

  DrizzleTaskRepository,

  { provide: TASK_REPOSITORY, useExisting: DrizzleTaskRepository },

  { provide: TASK_DRAFT_STATES, useClass: DrizzleTaskDraftStates },

  { provide: TASK_WORKSPACES, useClass: DrizzleTaskWorkspaces },

  { provide: LIVE_TASK_DRAFTS, useClass: HocuspocusLiveTaskDrafts },

  {
    provide: DraftSending,
    inject: [WORKSPACE_ACCESS, LIVE_TASK_DRAFTS, LOGGER],
    useFactory: (
      access: WorkspaceAccessPort,
      live: LiveTaskDraftsPort,
      logger: LoggerPort,
    ) => new DraftSending(access, live, logger),
  },

  TaskDraftCollab,

  DrizzleChatRepository,

  { provide: CHAT_REPOSITORY, useExisting: DrizzleChatRepository },

  DrizzleWorkspaceArchiveRepository,

  DrizzleNetworkCallRepository,

  DrizzleInboxRequestRepository,

  {
    provide: INBOX_REQUEST_REPOSITORY,
    useExisting: DrizzleInboxRequestRepository,
  },

  {
    provide: InboxRequests,
    inject: [
      INBOX_REQUEST_REPOSITORY,
      TASK_REPOSITORY,
      TRANSACTION,
      ID_GENERATOR,
      CLOCK,
    ],
    useFactory: (
      inboxRequests: InboxRequestRepository,
      tasks: TaskRepository,
      transaction: TransactionPort,
      ids: IdGeneratorPort,
      clock: ClockPort,
    ) => new InboxRequests(inboxRequests, tasks, transaction, ids, clock),
  },
  { provide: INBOX_REQUESTS, useExisting: InboxRequests },

  DrizzleNoticeRepository,

  { provide: NOTICE_REPOSITORY, useExisting: DrizzleNoticeRepository },

  {
    provide: Notices,
    inject: [
      NOTICE_REPOSITORY,
      WORKSPACE_ACCESS,
      TRANSACTION,
      ID_GENERATOR,
      CLOCK,
    ],
    useFactory: (
      notices: NoticeRepository,
      access: WorkspaceAccessPort,
      transaction: TransactionPort,
      ids: IdGeneratorPort,
      clock: ClockPort,
    ) => new Notices(notices, access, transaction, ids, clock),
  },
  {
    provide: NoticeLoader,
    inject: [NOTICE_REPOSITORY, WORKSPACE_ACCESS],
    useFactory: (notices: NoticeRepository, access: WorkspaceAccessPort) =>
      new NoticeLoader(notices, access),
  },
  { provide: NOTICES, useExisting: Notices },

  {
    provide: InboxRequestLoader,
    inject: [
      INBOX_REQUEST_REPOSITORY,
      TASK_REPOSITORY,
      LINE_MAPS,
      WORKSPACE_ACCESS,
    ],
    useFactory: (
      inboxRequests: InboxRequestRepository,
      tasks: TaskRepository,
      lines: LineMapsPort,
      access: WorkspaceAccessPort,
    ) => new InboxRequestLoader(inboxRequests, tasks, lines, access),
  },

  {
    provide: TASK_LINKS,
    inject: [ENV],
    useFactory: (env: Env) => new WebTaskLinks(publicUrlOf(env)),
  },

  {
    provide: TASK_VIEWS,
    inject: [TASK_REPOSITORY, LINE_MAPS, WORKSPACE_READER, TASK_LINKS],
    useFactory: (
      tasks: TaskRepository,
      lines: LineMapsPort,
      workspaces: WorkspaceReaderPort,
      links: TaskLinksPort,
    ) => new TaskViews(tasks, lines, workspaces, links),
  },

  {
    provide: TASK_NOTES_FROM_HOOKS,
    inject: [
      TASK_REPOSITORY,
      LINE_MAPS,
      PROCESSED_EVENTS,
      TASK_PLACEMENTS,
      TASK_DISPATCH,
      TRANSACTION,
      CLOCK,
    ],
    useFactory: (
      tasks: TaskRepository,
      lines: LineMapsPort,
      processedEvents: ProcessedEventsPort,
      placements: TaskPlacementsPort,
      dispatch: DispatchTask,
      transaction: TransactionPort,
      clock: ClockPort,
    ) =>
      new TaskNotesFromHooks(
        tasks,
        lines,
        processedEvents,
        placements,
        dispatch,
        transaction,
        clock,
      ),
  },

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
    provide: LongPollShutdown,
    inject: [LongPoll],
    useFactory: (polls: LongPoll) => new LongPollShutdown(polls),
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
  { provide: TEAM_WELCOMES, useClass: DrizzleTeamWelcomes },
  { provide: BRIEFED_TASKS, useClass: DrizzleBriefedTasks },

  { provide: CHAT_READER, useClass: DrizzleChatReader },

  { provide: CHAT_MARKS, useClass: DrizzleChatMarks },

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
    provide: NOTE_FILES,
    inject: [TASK_REPOSITORY, ATTACHMENT_STORE],
    useFactory: (tasks: TaskRepository, files: AttachmentStorePort) =>
      new NoteFiles(tasks, files),
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
    inject: [STATION_RUN_READER],
    useFactory: (reader: StationRunReaderPort) => new StationRuns(reader),
  },

  { provide: RUN_EVENT_READER, useClass: DrizzleRunEventReader },

  {
    provide: RUN_STREAM,
    inject: [RedisConnection, LOGGER],
    useFactory: (redis: RedisConnection, logger: LoggerPort): RunStreamPort => {
      const pubSub = redis.pubSub();

      return pubSub
        ? new RedisRunStream(pubSub.client, pubSub.subscriber, logger)
        : new InMemoryRunStream();
    },
  },

  {
    provide: RunLeases,
    inject: [DrizzleRunRepository],
    useFactory: (runs: DrizzleRunRepository) => new RunLeases(runs),
  },

  {
    provide: RunLeasesWorker,
    inject: [RunLeases, CLOCK, LOGGER],
    useFactory: (leases: RunLeases, clock: ClockPort, logger: LoggerPort) =>
      new RunLeasesWorker(leases, clock, logger),
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
    provide: RunCatalog,
    inject: [CATALOG],
    useFactory: (catalog: CatalogPort) => new RunCatalog(catalog),
  },

  {
    provide: ToolSources,
    inject: [BuiltInTools, INTEGRATION_TOOLS, RunCatalog],
    useFactory: (
      builtIns: BuiltInTools,
      integrations: IntegrationToolsPort,
      catalog: RunCatalog,
    ) => new ToolSources(builtIns, integrations, catalog),
  },

  {
    provide: StationSkills,
    inject: [TEAM_SKILLS],
    useFactory: (skills: TeamSkillsPort) => new StationSkills(skills),
  },

  { provide: TASK_PLACEMENTS, useClass: DrizzleTaskPlacements },

  DrizzleWorkStations,

  { provide: STATION_HOLDERS, useExisting: DrizzleWorkStations },

  { provide: SEEDING_HARNESS, useValue: DEFAULT_HARNESS },

  {
    provide: LINE_MAPS,
    inject: [LINES],
    useFactory: (lines: LinesPort) => new LinesLineMaps(lines),
  },

  {
    provide: LineLoader,
    inject: [WORKSPACE_ACCESS, LINE_MAPS],
    useFactory: (access: WorkspaceAccessPort, lines: LineMapsPort) =>
      new LineLoader(access, lines),
  },

  {
    provide: HAPPENING_REACTIONS,
    inject: [
      TASK_REPOSITORY,
      TASK_PLACEMENTS,
      LINE_MAPS,
      TASK_DISPATCH,
      TRANSACTION,
      CLOCK,
      ID_GENERATOR,
      MEMBER_DIRECTORY,
      ATTACHMENT_STORE,
      PROCESSED_EVENTS,
      LOGGER,
      CHAT_REPOSITORY,
      WORKSPACE_READER,
      HARNESS_LAUNCH,
      CHAT_DISPATCH,
      CHANNEL_NOTICES,
    ],
    useFactory: (
      tasks: TaskRepository,
      placements: TaskPlacementsPort,
      lines: LineMapsPort,
      dispatch: TaskDispatching,
      transaction: TransactionPort,
      clock: ClockPort,
      ids: IdGeneratorPort,
      members: MemberDirectoryPort,
      files: AttachmentStorePort,
      processedEvents: ProcessedEventsPort,
      logger: LoggerPort,
      chats: ChatRepository,
      workspaces: WorkspaceReaderPort,
      launch: HarnessLaunchPort,
      chatDispatch: ChatDispatching,
      channelNotices: ChannelNoticesPort,
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
        new ChannelChats(
          chats,
          lines,
          members,
          workspaces,
          launch,
          DEFAULT_HARNESS,
          chatDispatch,
          channelNotices,
          clock,
          ids,
          logger,
        ),
      ),
  },

  {
    provide: ReconcileSetup,
    inject: [
      TASK_REPOSITORY,
      LINE_MAPS,
      SetupStatus,
      CLOCK,
      LOGGER,
      TRANSACTION,
    ],
    useFactory: (
      tasks: TaskRepository,
      lines: LineMapsPort,
      setup: SetupStatus,
      clock: ClockPort,
      logger: LoggerPort,
      transaction: TransactionPort,
    ) => new ReconcileSetup(tasks, lines, setup, clock, logger, transaction),
  },

  {
    provide: RunLoader,
    inject: [DrizzleRunRepository, TASK_REPOSITORY],
    useFactory: (runs: DrizzleRunRepository, tasks: TaskRepository) =>
      new RunLoader(runs, tasks),
  },

  {
    provide: ConversationLoader,
    inject: [TASK_REPOSITORY, LINE_MAPS],
    useFactory: (tasks: TaskRepository, lines: LineMapsPort) =>
      new ConversationLoader(tasks, lines),
  },

  {
    provide: RunWorks,
    inject: [
      RUN_LEASES,
      RUN_FACTS,
      RUNS,
      DrizzleRunRepository,
      TASK_REPOSITORY,
      CHAT_REPOSITORY,
      LINE_MAPS,
      BRIEFED_TASKS,
      CLOCK,
    ],
    useFactory: (
      leases: RunLeasesPort,
      facts: RunFactsPort,
      runCommands: RunsPort,
      runs: DrizzleRunRepository,
      tasks: TaskRepository,
      chats: ChatRepository,
      lines: LineMapsPort,
      briefedTasks: BriefedTasksPort,
      clock: ClockPort,
    ) =>
      new RunWorks(
        leases,
        facts,
        runCommands,
        runs,
        tasks,
        chats,
        lines,
        briefedTasks,
        clock,
      ),
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
    inject: [CHAT_REPOSITORY],
    useFactory: (chats: ChatRepository) => new ChatLoader(chats),
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
      ID_GENERATOR,
      HARNESS_LAUNCH,
      TRACE_PARENT,
      TEAM_DIRECTORY,
      LINE_MAPS,
      CLOCK,
      TEAM_MEMORIES,
      LOGGER,
      SAVEPOINT,
      ENV,
      CONTROL_PLANE_RELEASE,
    ],
    useFactory: (
      ids: IdGeneratorPort,
      launch: HarnessLaunchPort,
      tracing: TraceParentPort,
      teams: TeamDirectoryPort,
      lines: LineMapsPort,
      clock: ClockPort,
      memories: TeamMemoriesPort,
      logger: LoggerPort,
      savepoint: SavepointPort,
      env: Env,
      controlPlane: ControlPlaneReleasePort,
    ) =>
      new DispatchChat(
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
        controlPlane,
      ),
  },

  {
    provide: AttachmentCopies,
    inject: [ATTACHMENT_STORE],
    useFactory: (store: AttachmentStorePort) => new AttachmentCopies(store),
  },

  {
    provide: CreateTaskFromProposal,
    inject: [
      CHAT_REPOSITORY,
      LINE_MAPS,
      TASK_PLACEMENTS,
      CreateTask,
      AttachmentCopies,
      ID_GENERATOR,
      CLOCK,
    ],
    useFactory: (
      chats: ChatRepository,
      lines: LineMapsPort,
      placements: TaskPlacementsPort,
      createTask: CreateTask,
      copies: AttachmentCopies,
      ids: IdGeneratorPort,
      clock: ClockPort,
    ) =>
      new CreateTaskFromProposal(
        chats,
        lines,
        placements,
        createTask,
        copies,
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
      ID_GENERATOR,
      BuiltInHarnesses,
      HARNESS_LAUNCH,
      TRACE_PARENT,
      BUILT_IN_SKILLS,
      StationSkills,
      TeamIntegrations,
      TASK_DECISIONS,
      RunCatalog,
      STATION_PROFILES,
      TEAM_MEMORIES,
      TouchedFiles,
      LOGGER,
      SAVEPOINT,
      CONTENT_HASH,
    ],
    useFactory: (
      ids: CryptoIdGenerator,
      harnesses: BuiltInHarnesses,
      launch: HarnessLaunchPort,
      tracing: TraceParentPort,
      skills: BuiltInSkillsPort,
      teamSkills: StationSkills,
      integrations: TeamIntegrations,
      decisions: TaskDecisionsPort,
      catalog: RunCatalog,
      profiles: StationProfilesPort,
      memories: TeamMemoriesPort,
      touched: TouchedFiles,
      logger: LoggerPort,
      savepoint: SavepointPort,
      hash: ContentHashPort,
    ) =>
      new DispatchTask(
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
      TASK_REPOSITORY,
      BRIEFED_TASKS,
      ID_GENERATOR,
      BuiltInHarnesses,
      HARNESS_LAUNCH,
      TRACE_PARENT,
      BUILT_IN_SKILLS,
      StationSkills,
      RunCatalog,
      STATION_PROFILES,
      MEMORIES_BRIEFED_BEFORE,
      ATTACHMENT_STORE,
      CONTENT_HASH,
      ReplayAnswers,
      DISPATCH_REPOSITORY,
      CLOCK,
    ],
    useFactory: (
      runs: DrizzleRunRepository,
      archives: DrizzleWorkspaceArchiveRepository,
      tasks: TaskRepository,
      briefedTasks: BriefedTasksPort,
      ids: CryptoIdGenerator,
      harnesses: BuiltInHarnesses,
      launch: HarnessLaunchPort,
      tracing: TraceParentPort,
      skills: BuiltInSkillsPort,
      teamSkills: StationSkills,
      catalog: RunCatalog,
      profiles: StationProfilesPort,
      memories: MemoriesBriefedBeforePort,
      files: AttachmentStorePort,
      hash: ContentHashPort,
      answers: ReplayAnswers,
      dispatches: DispatchRepository,
      clock: ClockPort,
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
        dispatches,
        clock,
      ),
  },

  {
    provide: CandidateLines,
    inject: [
      LINE_MAPS,
      LINE_RESOURCES,
      RunCatalog,
      BuiltInHarnesses,
      HARNESS_LAUNCH,
      BUILT_IN_SKILLS,
      StationSkills,
      STATION_PROFILES,
      CONTENT_HASH,
      ID_GENERATOR,
    ],
    useFactory: (
      lines: LineMapsPort,
      resources: LineResourcesPort,
      catalog: RunCatalog,
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
    inject: [CandidateLines, CONTENT_HASH],
    useFactory: (candidates: CandidateLines, hash: ContentHashPort) =>
      new ReplayCandidates(candidates, hash),
  },

  {
    provide: REPLAYABLE_RUNS,
    inject: [REPLAY_FACTS, STATION_RUN_READER],
    useFactory: (facts: ReplayFactsPort, stationRuns: StationRunReaderPort) =>
      new ReplayableRuns(facts, stationRuns),
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
      DISPATCH_REPOSITORY,
    ],
    useFactory: (
      runs: DrizzleRunRepository,
      claims: ReplayRunClaimsPort,
      candidates: CandidateLines,
      dispatch: DispatchReplay,
      answers: ReplayAnswers,
      transaction: TransactionPort,
      clock: ClockPort,
      dispatches: DispatchRepository,
    ) =>
      new ReplayRuns(
        runs,
        claims,
        candidates,
        dispatch,
        answers,
        transaction,
        clock,
        dispatches,
      ),
  },

  {
    provide: ReplayAnswers,
    inject: [TASK_REPOSITORY, RUN_EVIDENCE],
    useFactory: (tasks: TaskRepository, evidence: RunEvidencePort) =>
      new ReplayAnswers(tasks, evidence),
  },

  { provide: REPLAY_RUN_CLAIMS, useClass: DrizzleReplayRunClaims },

  {
    provide: SEARCH_DISPATCH,
    inject: [
      DrizzleRunRepository,
      LINE_MAPS,
      HARNESS_LAUNCH,
      TRACE_PARENT,
      TRANSACTION,
      CLOCK,
    ],
    useFactory: (
      runs: DrizzleRunRepository,
      lines: LineMapsPort,
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
    inject: [TASK_REPOSITORY, TASK_DISPATCH, TRANSACTION, FilesLoader],
    useFactory: (
      tasks: TaskRepository,
      dispatch: DispatchTask,
      transaction: TransactionPort,
      files: FilesLoader,
    ) => new CreateTask(tasks, dispatch, transaction, files),
  },

  {
    provide: IntegrationTaskViews,
    inject: [LINE_MAPS, CHAT_MARKS],
    useFactory: (lines: LineMapsPort, chatMarks: ChatMarksPort) =>
      new IntegrationTaskViews(lines, chatMarks),
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
      ID_GENERATOR,
      CLOCK,
      CreateTaskFromProposal,
      ReconcileSetup,
      TASK_REPOSITORY,
      OUTBOUND_TASK_NOTIFIER,
      LINE_MAPS,
      DrizzleRunRepository,
      CHAT_REPOSITORY,
      TASK_DISPATCH,
      CHAT_DISPATCH,
      RUN_USAGE_WRITER,
      TASK_PLACEMENTS,
      TRANSACTION,
      RUN_GRANTS,
      RunnerLeases,
      SandboxLeases,
      ToolUsedHooks,
      RUN_JOURNAL,
      RUN_USAGES,
      RUN_TOOLS,
      RUN_SPENDS,
      Notices,
      RUN_TOKENS,
      CHANNEL_NOTICES,
      INBOX_REQUEST_REPOSITORY,
      TASK_DRAFT_STATES,
      TEAM_WELCOMES,
      RUNS,
      DISPATCH_REPOSITORY,
    ],
    useFactory: (
      types: PayloadTypes,
      mappers: IntegrationEventMappers,
      subscribers: EventSubscribers,
      ids: IdGeneratorPort,
      clock: ClockPort,
      acceptances: CreateTaskFromProposal,
      setup: ReconcileSetup,
      tasks: TaskRepository,
      notifier: OutboundTaskNotifierPort,
      lines: LineMapsPort,
      runs: DrizzleRunRepository,
      chats: ChatRepository,
      taskDispatch: DispatchTask,
      chatDispatch: DispatchChat,
      usageWriter: RunUsageWriterPort,
      placements: TaskPlacementsPort,
      transaction: TransactionPort,
      runGrants: RunGrantsPort,
      ending: RunnerLeases,
      sandboxLeases: SandboxLeases,
      toolUsedHooks: ToolUsedHooks,
      journal: RunJournalPort,
      usages: RunUsageReaderPort,
      tools: RunToolsReaderPort,
      spends: RunSpendReaderPort,
      notices: Notices,
      runTokens: RunTokensPort,
      channelNotices: ChannelNoticesPort,
      inboxRequests: InboxRequestRepository,
      draftStates: TaskDraftStatesPort,
      welcomes: TeamWelcomesPort,
      runsFacade: RunsPort,
      dispatches: DispatchRepository,
    ) => {
      types.register('work', WORK_PAYLOAD_TYPES);
      mappers.register(WORK_EVENT_MAPPERS);
      subscribers.register([
        ...workSubscribers({
          handOver: new HandOver(tasks, placements, lines, taskDispatch, clock),
          pausedRuns: new PausedRuns(tasks, runs, lines),
          pauseMarks: new PauseMarks(journal),
          chatOutcomes: new ChatOutcomes(chats, chatDispatch),
          channel: new NotifyChannel(chats, lines, channelNotices),
          usages: new RecordRunUsage(usageWriter, usages, tools, spends),
          welcoming: new WelcomeTeam(lines, tasks, welcomes, ids, clock),
          acceptances,
          outsideTools: new NotifyOutsideTools(
            tasks,
            notifier,
            transaction,
            clock,
          ),
          taskRuns: new OrderTaskRun(
            tasks,
            lines,
            dispatches,
            taskDispatch,
            clock,
          ),
          detachedRuns: new CancelDetachedRun(runsFacade),
          chatRuns: new OrderChatRun(chats, dispatches, chatDispatch, clock),
          orderedRuns: new EnqueueOrderedRun(
            dispatches,
            tasks,
            chats,
            runsFacade,
            clock,
          ),
          unorderedRuns: new DropUnorderedRun(tasks, chats),
          dispatchEndings: new DispatchRunEndings(dispatches, clock),
          setup,
          deletingChats: new DeleteTeamChats(chats),
          taskInboxRequests: new DeleteTaskInboxRequests(inboxRequests),
          taskDraft: new DeleteTaskDraft(draftStates),
          runGrants,
          runTokens,
          runners: ending,
          sandboxes: sandboxLeases,
          toolUsedHooks,
          notices,
          takenMarks: new ReleaseTakenMarks(tasks, transaction),
        }),
      ]);
      return true;
    },
  },

  ...bindQueryHandler(ListTasksQuery, ListTasksHandler, [
    TASK_READER,
    WorkAccess,
  ]),

  ...bindQueryHandler(ReadTaskQuery, ReadTaskHandler, [
    TASK_READER,
    WorkAccess,
  ]),

  ...bindQueryHandler(ListTaskRunsQuery, ListTaskRunsHandler, [RUN_READER]),

  ...bindQueryHandler(ListTeamRunsQuery, ListTeamRunsHandler, [RUN_READER]),

  ...bindQueryHandler(ReadTeamRunQuery, ReadTeamRunHandler, [RUN_READER]),

  ...bindQueryHandler(ReadRunConfigQuery, ReadRunConfigHandler, [RUN_READER]),

  ...bindQueryHandler(ReadRunNetworkQuery, ReadRunNetworkHandler, [
    RUN_VIEWERS,
    RUN_EVENT_READER,
    RUN_CONNECTIONS,
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
    provide: SandboxArchives,
    inject: [SANDBOXES],
    useFactory: (sandboxes: SandboxesPort) => new SandboxArchives(sandboxes),
  },

  ...bindQueryHandler(StoredSandboxArchiveQuery, StoredSandboxArchiveHandler, [
    SandboxArchives,
    DrizzleWorkspaceArchiveRepository,
    WORKSPACE_ARCHIVE_STORE,
  ]),

  ...bindCommandHandler(
    GrantSandboxArchiveCommand,
    GrantSandboxArchiveHandler,
    [
      SandboxArchives,
      DrizzleWorkspaceArchiveRepository,
      WORKSPACE_ARCHIVE_STORE,
      ID_GENERATOR,
      CLOCK,
    ],
  ),

  ...bindCommandHandler(
    CompleteSandboxArchiveCommand,
    CompleteSandboxArchiveHandler,
    [
      SandboxArchives,
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

  ...bindQueryHandler(ListChatJournalRunsQuery, ListChatJournalRunsHandler, [
    RUN_JOURNAL_READER,
  ]),

  ...bindQueryHandler(RunStopRequestedQuery, RunStopRequestedHandler, [
    LEASED_RUN_READER,
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
    provide: SandboxLeases,
    inject: [SANDBOXES, DrizzleRunRepository, CLOCK],
    useFactory: (
      sandboxes: SandboxesPort,
      runs: DrizzleRunRepository,
      clock: ClockPort,
    ) => new SandboxLeases(sandboxes, runs, clock),
  },

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
      SANDBOXES,
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
      sandboxes: SandboxesPort,
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
        sandboxes,
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

  {
    provide: RunAccess,
    inject: [RUN_FACTS, CHAT_REPOSITORY, WORKSPACE_ACCESS],
    useFactory: (
      facts: RunFactsPort,
      chats: ChatRepository,
      access: WorkspaceAccessPort,
    ) => new RunAccess(facts, chats, access),
  },

  { provide: RUN_VIEWERS, useExisting: RunAccess },

  {
    provide: WorkAccess,
    inject: [WORKSPACE_ACCESS, WORKSPACE_READER, TEAM_DIRECTORY],
    useFactory: (
      access: WorkspaceAccessPort,
      workspaces: WorkspaceReaderPort,
      teams: TeamDirectoryPort,
    ) => new WorkAccess(access, workspaces, teams),
  },

  ...bindQueryHandler(ListInboxQuery, ListInboxHandler, [
    INBOX_READER,
    WorkAccess,
  ]),

  ...bindQueryHandler(ReadInboxItemQuery, ReadInboxItemHandler, [
    INBOX_READER,
    WorkAccess,
  ]),

  ...bindQueryHandler(ReadInboxNoticeQuery, ReadInboxNoticeHandler, [
    INBOX_READER,
    WorkAccess,
  ]),

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

  ...bindQueryHandler(ListTaskJournalRunsQuery, ListTaskJournalRunsHandler, [
    RUN_JOURNAL_READER,
  ]),

  ...bindQueryHandler(WatchRunQuery, WatchRunHandler, [RUN_VIEWERS]),

  ...bindQueryHandler(ReadRunEventsQuery, ReadRunEventsHandler, [
    RUN_VIEWERS,
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

  ...bindCommandHandler(
    GrantRunAttachmentUploadCommand,
    GrantRunAttachmentUploadHandler,
    [DrizzleRunRepository, ATTACHMENT_STORE, ID_GENERATOR],
  ),

  ...bindCommandHandler(DeleteTaskCommand, DeleteTaskHandler, [
    TASK_REPOSITORY,
    LineLoader,
    TRANSACTION,
  ]),

  ...bindCommandHandler(AnswerConversationCommand, AnswerConversationHandler, [
    ConversationLoader,
    TASK_REPOSITORY,
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

  ...bindCommandHandler(ConnectEditorCommand, ConnectEditorHandler, [
    TASK_WORKSPACES,
    CHAT_REPOSITORY,
    WORKSPACE_ACCESS,
    EDITOR_LEASES,
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
    TEAM_WELCOMES,
  ]),

  ...bindCommandHandler(
    MarkInboxRequestReadCommand,
    MarkInboxRequestReadHandler,
    [InboxRequestLoader, INBOX_REQUEST_REPOSITORY, CLOCK],
  ),
  ...bindCommandHandler(ResolveNoticeCommand, ResolveNoticeHandler, [
    NoticeLoader,
    NOTICE_REPOSITORY,
    CLOCK,
  ]),
  ...bindCommandHandler(
    MarkConversationReadCommand,
    MarkConversationReadHandler,
    [ConversationLoader, TASK_REPOSITORY, CLOCK],
  ),
  ...bindCommandHandler(
    ResolveConversationCommand,
    ResolveConversationHandler,
    [ConversationLoader, TASK_REPOSITORY, CLOCK],
  ),
  ...bindCommandHandler(
    ResolveInboxRequestCommand,
    ResolveInboxRequestHandler,
    [InboxRequestLoader, INBOX_REQUEST_REPOSITORY, CLOCK],
  ),
  ...bindCommandHandler(ReopenConversationCommand, ReopenConversationHandler, [
    ConversationLoader,
    TASK_REPOSITORY,
    CLOCK,
  ]),
  ...bindCommandHandler(ReopenInboxRequestCommand, ReopenInboxRequestHandler, [
    InboxRequestLoader,
    INBOX_REQUEST_REPOSITORY,
    CLOCK,
  ]),
  ...bindCommandHandler(ReopenNoticeCommand, ReopenNoticeHandler, [
    NoticeLoader,
    NOTICE_REPOSITORY,
  ]),

  {
    provide: OpenPullRequest,
    inject: [
      TASK_REPOSITORY,
      LINE_MAPS,
      PULL_REQUESTS,
      TRANSACTION,
      TASK_VIEWS,
      LIFECYCLE_HOOKS,
      CLOCK,
    ],
    useFactory: (
      tasks: TaskRepository,
      lines: LineMapsPort,
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
      CHAT_REPOSITORY,
      LINE_MAPS,
      CLOCK,
      PULL_REQUEST_REVIEWING,
      PULL_REQUESTS,
      TRANSACTION,
      STATION_CHANGE_TESTS,
      TASK_REPOSITORY,
      CHECK_RUNS,
      AttachmentCopies,
    ],
    useFactory: (
      opening: OpenPullRequest,
      chats: ChatRepository,
      lines: LineMapsPort,
      clock: ClockPort,
      reviewing: PullRequestReviewingPort,
      pullRequests: PullRequestPort,
      transaction: TransactionPort,
      tests: StationChangeTestsPort,
      tasks: TaskRepository,
      checkRuns: CheckRunsPort,
      copies: AttachmentCopies,
    ): readonly BuiltInToolUse[] => [
      new PullRequestToolUse(opening),
      new ChecksToolUse(tasks, checkRuns),
      new ProposeTaskToolUse(chats, lines, copies, clock),
      new SetupPullRequestToolUse(chats, pullRequests, transaction, clock),
      new ReviewCommentToolUse(reviewing),
      new ReviewToolUse(reviewing),
      new TestStationChangeToolUse(chats, tests),
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
      TASK_REPOSITORY,
      LINE_MAPS,
      IntegrationTaskViews,
      INTEGRATION_TOOL_CALLS,
      RunWorks,
    ],
    useFactory: (
      tasks: TaskRepository,
      lines: LineMapsPort,
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
    CHAT_REPOSITORY,
    FilesLoader,
    TracesLoader,
    LINE_MAPS,
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
    CHAT_REPOSITORY,
    FilesLoader,
    TracesLoader,
    CHAT_DISPATCH,
    CLOCK,
    TRANSACTION,
  ]),

  ...bindCommandHandler(StopChatCommand, StopChatHandler, [ChatLoader, RUNS]),

  ...bindCommandHandler(AcceptProposalCommand, AcceptProposalHandler, [
    ChatLoader,
    CHAT_REPOSITORY,
    CLOCK,
  ]),

  ...bindCommandHandler(DismissProposalCommand, DismissProposalHandler, [
    ChatLoader,
    CHAT_REPOSITORY,
    CLOCK,
  ]),

  ...bindCommandHandler(
    ReplyToReviewCommentCommand,
    ReplyToReviewCommentHandler,
    [RunLoader, TASK_REPOSITORY, LINE_MAPS, REVIEW_COMMENTS, CLOCK],
  ),

  ...bindCommandHandler(SendMessageCommand, SendMessageHandler, [
    RUN_FACTS,
    TASK_REPOSITORY,
    LINE_MAPS,
    TRANSACTION,
    TASK_DISPATCH,
    CLOCK,
    FilesLoader,
    WORKSPACE_ACCESS,
    DraftSending,
  ]),

  ...bindCommandHandler(StopRunCommand, StopRunHandler, [
    RUNS,
    RUN_FACTS,
    TASK_REPOSITORY,
  ]),

  ...bindCommandHandler(AckMessagesCommand, AckMessagesHandler, [
    RunWorks,
    CLOCK,
  ]),

  ...bindCommandHandler(MoveTaskCommand, MoveTaskHandler, [
    TASK_REPOSITORY,
    TASK_PLACEMENTS,
    LineLoader,
    TRANSACTION,
    TASK_DISPATCH,
    CLOCK,
    TASK_READER,
  ]),

  ...bindCommandHandler(AssignTaskCommand, AssignTaskHandler, [
    TASK_REPOSITORY,
    TEAM_DIRECTORY,
    TRANSACTION,
    TASK_READER,
    LINE_MAPS,
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
    SANDBOXES,
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
    SANDBOXES,
    SANDBOX_HOSTS,
  ]),

  ...bindCommandHandler(ClaimHostCallCommand, ClaimHostCallHandler, [
    RUNNER_AUTHENTICATOR,
    RUNNERS,
    DrizzleNetworkCallRepository,
    CLOCK,
    LongPoll,
    TOKEN_ISSUER,
  ]),

  ...bindCommandHandler(
    RecordHostCallResponseCommand,
    RecordHostCallResponseHandler,
    [RUNNER_AUTHENTICATOR, DrizzleNetworkCallRepository, CLOCK],
  ),

  ...bindCommandHandler(RedeemCallSecretsCommand, RedeemCallSecretsHandler, [
    DrizzleNetworkCallRepository,
    CALL_SECRET_FETCHES,
    TOKEN_ISSUER,
    CLOCK,
  ]),

  {
    provide: EgressSecretFetches,
    inject: [
      DrizzleRunRepository,
      RUN_SECRET_FETCHES,
      RUN_GRANTS,
      SANDBOX_HOSTS,
      CHAT_REPOSITORY,
      RUN_TOKENS,
      CLOCK,
      CONTROL_PLANE_HOST,
    ],
    useFactory: (
      runs: DrizzleRunRepository,
      runSecretFetches: RunSecretFetchesPort,
      grants: RunGrantsPort,
      sandboxHosts: SandboxHostsPort,
      chats: ChatRepository,
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

  ...bindQueryHandler(AuthorizeRunnerQuery, AuthorizeRunnerHandler, [
    RUNNER_EGRESS,
    SANDBOX_HOSTS,
    CLOCK,
    CONTROL_PLANE_HOST,
    CONTROL_PLANE_PORT,
  ]),

  ...bindQueryHandler(ActiveRunsQuery, ActiveRunsHandler, [
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
    TASK_REPOSITORY,
    LINE_MAPS,
    TRANSACTION,
    TASK_VIEWS,
    LIFECYCLE_HOOKS,
    CLOCK,
    RUN_JOURNAL_READER,
    FilesLoader,
  ]),

  ...bindCommandHandler(EnqueueRunCommand, EnqueueRunHandler, [
    RUNS,
    ID_GENERATOR,
    HARNESS_LAUNCH,
    WORKSPACE_ACCESS,
  ]),
];
