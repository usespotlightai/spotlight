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
import { LINES, type LinesPort } from '@lines/application/ports/lines.port';
import { STATION_DELETION_GUARD } from '@lines/application/ports/station-deletion-guard.port';
import type { Provider, Type } from '@nestjs/common';
import { ENV } from '@platform/config/config.constants';
import { publicUrlOf } from '@platform/config/env';
import type { Env } from '@platform/config/env.schema';
import { bindCommandHandler } from '@platform/cqrs/bind-command-handler';
import { bindQueryHandler } from '@platform/cqrs/bind-query-handler';
import { EventSubscribers } from '@platform/events/event-subscribers';
import { IntegrationEventMappers } from '@platform/events/integration-event-mappers';
import { PayloadTypes } from '@platform/events/payload-types';
import { Sha256ContentHash } from '@platform/hashing/sha256-content-hash';
import { ReadinessChecks } from '@platform/health/readiness-checks';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { s3ClientsOf } from '@platform/storage/s3-clients';
import { EDITOR_LEASES } from '@runners/application/ports/editor-leases.port';
import {
  RUNNER_READER,
  type RunnerReaderPort,
} from '@runners/application/ports/runner-reader.port';
import {
  ARCHIVE_HOLDERS,
  type ArchiveHoldersPort,
} from '@runs/application/ports/archive-holders.port';
import {
  HARNESS_LAUNCH,
  type HarnessLaunchPort,
} from '@runs/application/ports/harness-launch.port';
import { HARNESS_TOOL_NAMES } from '@runs/application/ports/harness-tool-names.port';
import {
  RUN_CONNECTIONS,
  type RunConnectionsPort,
} from '@runs/application/ports/run-connections.port';
import {
  RUN_FACTS,
  type RunFactsPort,
} from '@runs/application/ports/run-facts.port';
import {
  RUN_FILES,
  type RunFilesPort,
} from '@runs/application/ports/run-files.port';
import {
  RUN_JOURNAL_READINGS,
  type RunJournalReadingsPort,
} from '@runs/application/ports/run-journal-readings.port';
import {
  RUN_LEASES,
  type RunLeasesPort,
} from '@runs/application/ports/run-leases.port';
import {
  RUN_REQUESTER_LABELS,
  type RunRequesterLabelsPort,
} from '@runs/application/ports/run-requester-labels.port';
import {
  RUN_START_GATES,
  type RunStartGatesPort,
} from '@runs/application/ports/run-start-gates.port';
import {
  RUN_TURNS,
  type RunTurnsPort,
} from '@runs/application/ports/run-turns.port';
import {
  RUN_USAGES,
  type RunUsageReaderPort,
} from '@runs/application/ports/run-usage-reader.port';
import {
  RUN_VIEWERS,
  type RunViewersPort,
} from '@runs/application/ports/run-viewers.port';
import { RUNS, type RunsPort } from '@runs/application/ports/runs.port';
import {
  CLOCK,
  type ClockPort,
} from '@shared-kernel/application/ports/clock.port';
import {
  ID_GENERATOR,
  type IdGeneratorPort,
} from '@shared-kernel/application/ports/id-generator.port';
import {
  LOGGER,
  type LoggerPort,
} from '@shared-kernel/application/ports/logger.port';
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
import { AnswerConversationCommand } from '@work/application/commands/answer-conversation.command';
import { AskPermissionCommand } from '@work/application/commands/ask-permission.command';
import { AssignTaskCommand } from '@work/application/commands/assign-task.command';
import { CarryGitCallCommand } from '@work/application/commands/carry-git-call.command';
import {
  AcceptProposalCommand,
  DismissProposalCommand,
  SendChatMessageCommand,
  StartChatCommand,
  StopChatCommand,
} from '@work/application/commands/chat.commands';
import { ConnectEditorCommand } from '@work/application/commands/connect-editor.command';
import { DeleteTaskCommand } from '@work/application/commands/delete-task.command';
import { GrantAttachmentUploadCommand } from '@work/application/commands/grant-attachment-upload.command';
import { GrantRunAttachmentUploadCommand } from '@work/application/commands/grant-run-attachment-upload.command';
import { AcceptProposalHandler } from '@work/application/commands/handlers/accept-proposal.handler';
import { AckMessagesHandler } from '@work/application/commands/handlers/ack-messages.handler';
import { AddTaskHandler } from '@work/application/commands/handlers/add-task.handler';
import { AnswerConversationHandler } from '@work/application/commands/handlers/answer-conversation.handler';
import { AskPermissionHandler } from '@work/application/commands/handlers/ask-permission.handler';
import { AssignTaskHandler } from '@work/application/commands/handlers/assign-task.handler';
import { CarryGitCallHandler } from '@work/application/commands/handlers/carry-git-call.handler';
import { ConnectEditorHandler } from '@work/application/commands/handlers/connect-editor.handler';
import { DeleteTaskHandler } from '@work/application/commands/handlers/delete-task.handler';
import { DismissProposalHandler } from '@work/application/commands/handlers/dismiss-proposal.handler';
import { GrantAttachmentUploadHandler } from '@work/application/commands/handlers/grant-attachment-upload.handler';
import { GrantRunAttachmentUploadHandler } from '@work/application/commands/handlers/grant-run-attachment-upload.handler';
import { KeepTaskDraftHandler } from '@work/application/commands/handlers/keep-task-draft.handler';
import { MarkConversationReadHandler } from '@work/application/commands/handlers/mark-conversation-read.handler';
import { MarkInboxRequestReadHandler } from '@work/application/commands/handlers/mark-inbox-request-read.handler';
import { MoveTaskHandler } from '@work/application/commands/handlers/move-task.handler';
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
import { SendMessageCommand } from '@work/application/commands/send-message.command';
import { StopRunCommand } from '@work/application/commands/stop-run.command';
import { UseToolCommand } from '@work/application/commands/use-tool.command';
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
import { ProjectLineStations } from '@work/application/events/handlers/project-line-stations.handler';
import { ReleaseTakenMarks } from '@work/application/events/handlers/release-taken-marks.handler';
import { TakeUpAnsweredRun } from '@work/application/events/handlers/take-up-answered-run.handler';
import { WelcomeTeam } from '@work/application/events/handlers/welcome-team.handler';
import { WORK_EVENT_MAPPERS } from '@work/application/integration-events/work.event-mappers';
import { ACCESSIBLE_REPOSITORIES } from '@work/application/ports/accessible-repositories.port';
import {
  ATTACHMENT_READER,
  type AttachmentReaderPort,
} from '@work/application/ports/attachment-reader.port';
import {
  ATTACHMENT_STORE,
  type AttachmentStorePort,
} from '@work/application/ports/attachment-store.port';
import {
  BUILT_IN_SKILLS,
  type BuiltInSkillsPort,
} from '@work/application/ports/built-in-skills.port';
import {
  BUILT_IN_TOOL_USES,
  type BuiltInToolUse,
} from '@work/application/ports/built-in-tool-uses.port';
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
import { CHAT_TOOL_EXTENSIONS } from '@work/application/ports/chat-tool-extensions.port';
import {
  CHECK_ACCESS,
  type CheckAccessPort,
} from '@work/application/ports/check-access.port';
import { CONNECTION_ASKS } from '@work/application/ports/connection-asks.port';
import {
  CONTENT_HASH,
  type ContentHashPort,
} from '@work/application/ports/content-hash.port';
import {
  CONTROL_PLANE_RELEASE,
  type ControlPlaneReleasePort,
} from '@work/application/ports/control-plane-release.port';
import {
  DISPATCHED_RUNS,
  type DispatchedRunsPort,
} from '@work/application/ports/dispatched-runs.port';
import { HAPPENING_REACTIONS } from '@work/application/ports/happening-reactions.port';
import { INBOX_READER } from '@work/application/ports/inbox-reader.port';
import { INBOX_REQUESTS } from '@work/application/ports/inbox-requests.port';
import {
  INTEGRATION_TOOL_CALLS,
  type IntegrationToolCallsPort,
} from '@work/application/ports/integration-tool-calls.port';
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
import { NOTE_FILES } from '@work/application/ports/note-files.port';
import { NOTICES } from '@work/application/ports/notices.port';
import {
  PROCESSED_EVENTS,
  type ProcessedEventsPort,
} from '@work/application/ports/processed-events.port';
import {
  PULL_REQUEST_REVIEWING,
  type PullRequestReviewingPort,
} from '@work/application/ports/pull-request-reviewing.port';
import {
  RUN_EVIDENCE,
  type RunEvidencePort,
} from '@work/application/ports/run-evidence.port';
import {
  RUN_JOURNAL_READER,
  type RunJournalReaderPort,
} from '@work/application/ports/run-journal-reader.port';
import { RUN_READER } from '@work/application/ports/run-reader.port';
import { RUN_RESULTS } from '@work/application/ports/run-results.port';
import { RUNNER_TRACE_READER } from '@work/application/ports/runner-trace-reader.port';
import {
  SAVEPOINT,
  type SavepointPort,
} from '@work/application/ports/savepoint.port';
import { STATION_CONFIG_CANDIDATES } from '@work/application/ports/station-config-candidates.port';
import { STATION_HISTORY } from '@work/application/ports/station-history.port';
import {
  STATION_PROFILES,
  type StationProfilesPort,
} from '@work/application/ports/station-profiles.port';
import {
  STATION_RUN_READER,
  type StationRunReaderPort,
} from '@work/application/ports/station-run-reader.port';
import { STATION_RUNS } from '@work/application/ports/station-runs.port';
import { STATION_TRIALS } from '@work/application/ports/station-trials.port';
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
import {
  TASK_LOOKUP_READER,
  type TaskLookupReaderPort,
} from '@work/application/ports/task-lookup-reader.port';
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
  TOOL_USES,
  type ToolUsesPort,
} from '@work/application/ports/tool-uses.port';
import {
  TRACE_PARENT,
  type TraceParentPort,
} from '@work/application/ports/trace-parent.port';
import { TRACE_SCOPES } from '@work/application/ports/trace-scopes.port';
import {
  TRACED_TASK_READER,
  type TracedTaskReaderPort,
} from '@work/application/ports/traced-task-reader.port';
import {
  TRIAL_FACTS,
  type TrialFactsPort,
} from '@work/application/ports/trial-facts.port';
import { TRIALABLE_RUNS } from '@work/application/ports/trialable-runs.port';
import {
  TURN_RETAKES,
  type TurnRetakesPort,
} from '@work/application/ports/turn-retakes.port';
import { WORK_RUN_LOOKUP } from '@work/application/ports/work-run-lookup.port';
import {
  WORK_STATIONS,
  type WorkStationsPort,
} from '@work/application/ports/work-stations.port';
import { WORK_TASK_LOOKUP } from '@work/application/ports/work-task-lookup.port';
import {
  ListChatJournalRunsQuery,
  ListChatsQuery,
  ReadChatJournalQuery,
  ReadChatQuery,
} from '@work/application/queries/chat.queries';
import { JoinTaskDraftHandler } from '@work/application/queries/handlers/join-task-draft.handler';
import { ListChatJournalRunsHandler } from '@work/application/queries/handlers/list-chat-journal-runs.handler';
import { ListChatsHandler } from '@work/application/queries/handlers/list-chats.handler';
import {
  ListInboxHandler,
  ReadInboxItemHandler,
  ReadInboxNoticeHandler,
} from '@work/application/queries/handlers/list-inbox.handler';
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
import { ReadAttachmentHandler } from '@work/application/queries/handlers/read-attachment.handler';
import { ReadChatHandler } from '@work/application/queries/handlers/read-chat.handler';
import { ReadChatJournalHandler } from '@work/application/queries/handlers/read-chat-journal.handler';
import { ReadRunAttachmentHandler } from '@work/application/queries/handlers/read-run-attachment.handler';
import { ReadRunConfigHandler } from '@work/application/queries/handlers/read-run-config.handler';
import { ReadRunNotesHandler } from '@work/application/queries/handlers/read-run-notes.handler';
import { ReadRunnerHistoryHandler } from '@work/application/queries/handlers/read-runner-history.handler';
import { ReadRunnerTraceHandler } from '@work/application/queries/handlers/read-runner-trace.handler';
import { ReadTaskDraftHandler } from '@work/application/queries/handlers/read-task-draft.handler';
import { ReadTaskJournalHandler } from '@work/application/queries/handlers/read-task-journal.handler';
import { ReadTaskTraceHandler } from '@work/application/queries/handlers/read-task-trace.handler';
import {
  ListInboxQuery,
  ReadInboxItemQuery,
  ReadInboxNoticeQuery,
} from '@work/application/queries/list-inbox.query';
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
import { ReadAttachmentQuery } from '@work/application/queries/read-attachment.query';
import { ReadRunAttachmentQuery } from '@work/application/queries/read-run-attachment.query';
import { ReadRunConfigQuery } from '@work/application/queries/read-run-config.query';
import { ReadRunNotesQuery } from '@work/application/queries/read-run-notes.query';
import { ReadRunnerHistoryQuery } from '@work/application/queries/read-runner-history.query';
import { ReadRunnerTraceQuery } from '@work/application/queries/read-runner-trace.query';
import {
  ListTaskJournalRunsQuery,
  ReadTaskJournalQuery,
} from '@work/application/queries/read-task-journal.query';
import { ReadTaskTraceQuery } from '@work/application/queries/read-task-trace.query';
import {
  JoinTaskDraftQuery,
  ReadTaskDraftQuery,
} from '@work/application/queries/task-draft.queries';
import { AttachmentCopies } from '@work/application/services/attachment-copies';
import { BuiltInTools } from '@work/application/services/built-in-tools.service';
import { CandidateLines } from '@work/application/services/candidate-lines.service';
import { CarryGitCall } from '@work/application/services/carry-git-call.service';
import { ChannelChats } from '@work/application/services/channel-chats.service';
import { ChatLoader } from '@work/application/services/chat-loader.service';
import { ChatToolExtensions } from '@work/application/services/chat-tool-extensions.service';
import { ChecksToolUse } from '@work/application/services/checks.tool-use';
import { CiSetups } from '@work/application/services/ci-setups.service';
import { ConnectionsMade } from '@work/application/services/connections-made.service';
import { ConversationLoader } from '@work/application/services/conversation-loader.service';
import { CreateTask } from '@work/application/services/create-task';
import { DispatchChat } from '@work/application/services/dispatch-chat.service';
import { DispatchTask } from '@work/application/services/dispatch-task.service';
import { DraftSending } from '@work/application/services/draft-sending.service';
import { FilesLoader } from '@work/application/services/files-loader.service';
import { HistoryAccesses } from '@work/application/services/history-accesses.service';
import { InboxRequestLoader } from '@work/application/services/inbox-request-loader.service';
import { InboxRequests } from '@work/application/services/inbox-requests.service';
import { IntegrationTaskViews } from '@work/application/services/integration-task-views.service';
import { IntegrationTools } from '@work/application/services/integration-tools.service';
import { LineLoader } from '@work/application/services/line-loader.service';
import { NoteFiles } from '@work/application/services/note-files.service';
import { NoticeLoader } from '@work/application/services/notice-loader.service';
import { Notices } from '@work/application/services/notices.service';
import { OpenPullRequest } from '@work/application/services/open-pull-request.service';
import { OutsideTaskNotices } from '@work/application/services/outside-task-notices.service';
import { ProposeTaskToolUse } from '@work/application/services/propose-task.tool-use';
import { PullRequestToolUse } from '@work/application/services/pull-request.tool-use';
import { PurgeProcessedEvents } from '@work/application/services/purge-processed-events.service';
import { PurgeToolUses } from '@work/application/services/purge-tool-uses.service';
import { ReactToHappenings } from '@work/application/services/react-to-happenings.service';
import { ReconcileSetup } from '@work/application/services/reconcile-setup.service';
import { ReviewToolUse } from '@work/application/services/review.tool-use';
import { ReviewCommentToolUse } from '@work/application/services/review-comment.tool-use';
import { RunAccess } from '@work/application/services/run-access.service';
import { RunCatalog } from '@work/application/services/run-catalog.service';
import { RunEvidences } from '@work/application/services/run-evidences.service';
import { RunFiles } from '@work/application/services/run-files.service';
import { RunLoader } from '@work/application/services/run-loader.service';
import { RunRouting } from '@work/application/services/run-routing.service';
import { RunWorks } from '@work/application/services/run-works.service';
import { SetupPullRequestToolUse } from '@work/application/services/setup-pull-request.tool-use';
import { SetupStatus } from '@work/application/services/setup-status.service';
import { StationConfigCandidates } from '@work/application/services/station-config-candidates.service';
import { StationOrdering } from '@work/application/services/station-ordering';
import { StationRunHistories } from '@work/application/services/station-run-histories.service';
import { StationRuns } from '@work/application/services/station-runs.service';
import { StationSkills } from '@work/application/services/station-skills.service';
import { StationTrials } from '@work/application/services/station-trials.service';
import { TakeTurn } from '@work/application/services/take-turn.service';
import { TaskNotesFromHooks } from '@work/application/services/task-notes-from-hooks.service';
import { TaskRunStartGate } from '@work/application/services/task-run-start-gate.service';
import { TaskViews } from '@work/application/services/task-views.service';
import { TeamIntegrations } from '@work/application/services/team-integrations.service';
import { ToolSources } from '@work/application/services/tool-sources.service';
import { ToolUsedHooks } from '@work/application/services/tool-used-hooks.service';
import { TouchedFiles } from '@work/application/services/touched-files';
import { TraceScopes } from '@work/application/services/trace-scopes.service';
import { TracesLoader } from '@work/application/services/traces-loader.service';
import { TrialableRuns } from '@work/application/services/trialable-runs.service';
import { Turns } from '@work/application/services/turns.service';
import { WorkAccess } from '@work/application/services/work-access.service';
import { WorkRunLookup } from '@work/application/services/work-run-lookup.service';
import { WorkTaskLookup } from '@work/application/services/work-task-lookup.service';
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
import { LinesLineMaps } from '@work/infrastructure/acl/lines.adapter';
import { RunsHarnessCatalogue } from '@work/infrastructure/acl/runs-harness-catalogue';
import { DrizzleTaskDraftStates } from '@work/infrastructure/collab/drizzle-task-draft-states';
import { HocuspocusLiveTaskDrafts } from '@work/infrastructure/collab/hocuspocus-live-task-drafts';
import { WORK_PAYLOAD_TYPES } from '@work/infrastructure/events/work-payload-types';
import { GitHubAccessibleRepositories } from '@work/infrastructure/github/github-accessible-repositories';
import { WebTaskLinks } from '@work/infrastructure/links/web-task-links';
import { DrizzleProcessedEvents } from '@work/infrastructure/persistence/drizzle/ledgers/processed-events.ledger';
import { DrizzleTeamWelcomes } from '@work/infrastructure/persistence/drizzle/ledgers/team-welcomes.ledger';
import { DrizzleToolUses } from '@work/infrastructure/persistence/drizzle/ledgers/tool-uses.ledger';
import { DrizzleTurnRetakes } from '@work/infrastructure/persistence/drizzle/ledgers/turn-retakes.ledger';
import { DrizzleWorkStations } from '@work/infrastructure/persistence/drizzle/projections/work-stations.projection';
import { DrizzleAttachmentReader } from '@work/infrastructure/persistence/drizzle/readers/attachment.reader';
import { DrizzleChatReader } from '@work/infrastructure/persistence/drizzle/readers/chat.reader';
import { DrizzleChatMarks } from '@work/infrastructure/persistence/drizzle/readers/chat-marks.reader';
import { DrizzleDispatchedRuns } from '@work/infrastructure/persistence/drizzle/readers/dispatched-runs.reader';
import { DrizzleInboxReader } from '@work/infrastructure/persistence/drizzle/readers/inbox.reader';
import { DrizzleRunReader } from '@work/infrastructure/persistence/drizzle/readers/run.reader';
import { DrizzleRunJournalReader } from '@work/infrastructure/persistence/drizzle/readers/run-journal.reader';
import { DrizzleRunnerTraceReader } from '@work/infrastructure/persistence/drizzle/readers/runner-trace.reader';
import { DrizzleStationRunReader } from '@work/infrastructure/persistence/drizzle/readers/station-run.reader';
import { DrizzleTaskReader } from '@work/infrastructure/persistence/drizzle/readers/task.reader';
import { DrizzleTaskLookupReader } from '@work/infrastructure/persistence/drizzle/readers/task-lookup.reader';
import { DrizzleTaskPlacements } from '@work/infrastructure/persistence/drizzle/readers/task-placements.reader';
import { DrizzleTaskWorkspaces } from '@work/infrastructure/persistence/drizzle/readers/task-workspaces.reader';
import { DrizzleTracedTaskReader } from '@work/infrastructure/persistence/drizzle/readers/traced-task.reader';
import { DrizzleTrialFacts } from '@work/infrastructure/persistence/drizzle/readers/trial-facts.reader';
import { DrizzleWorkArchiveHolders } from '@work/infrastructure/persistence/drizzle/readers/work-archive-holders.reader';
import { DrizzleWorkRequesterLabels } from '@work/infrastructure/persistence/drizzle/readers/work-requester-labels.reader';
import { DrizzleChatRepository } from '@work/infrastructure/persistence/drizzle/repositories/chat.repository';
import { DrizzleDispatchRepository } from '@work/infrastructure/persistence/drizzle/repositories/dispatch.repository';
import { DrizzleInboxRequestRepository } from '@work/infrastructure/persistence/drizzle/repositories/inbox-request.repository';
import { DrizzleNoticeRepository } from '@work/infrastructure/persistence/drizzle/repositories/notice.repository';
import { DrizzleTaskRepository } from '@work/infrastructure/persistence/drizzle/repositories/task.repository';
import { DrizzleStationDeletionGuard } from '@work/infrastructure/persistence/drizzle/station-deletion.guard';
import { S3AttachmentStore } from '@work/infrastructure/storage/s3-attachment.store';
import { S3Readiness } from '@work/infrastructure/storage/s3-readiness';
import { HashedTraceParent } from '@work/infrastructure/tracing/hashed-trace-parent';
import { TaskDraftCollab } from '@work/presentation/collab/task-draft.collab';
import { workSubscribers } from '@work/presentation/events/work.subscribers';
import { workStationSubscribers } from '@work/presentation/events/work-stations.subscribers';
import { AttachmentController } from '@work/presentation/http/controllers/attachment.controller';
import { ChatController } from '@work/presentation/http/controllers/chat.controller';
import { EditorConnectionController } from '@work/presentation/http/controllers/editor-connection.controller';
import { GitController } from '@work/presentation/http/controllers/git.controller';
import { InboxController } from '@work/presentation/http/controllers/inbox.controller';
import { OnboardingController } from '@work/presentation/http/controllers/onboarding.controller';
import { RunWorkController } from '@work/presentation/http/controllers/run-work.controller';
import { TaskController } from '@work/presentation/http/controllers/task.controller';
import { ProcessedEventsWorker } from '@work/presentation/workers/processed-events.worker';
import { ToolUsesWorker } from '@work/presentation/workers/tool-uses.worker';
import { TurnsWorker } from '@work/presentation/workers/turns.worker';

const WORK_EVENTS = Symbol('WORK_EVENTS');

const WORK_STATION_EVENTS = Symbol('WORK_STATION_EVENTS');

export const WORK_CONTROLLERS: readonly Type[] = [
  RunWorkController,
  InboxController,
  AttachmentController,
  GitController,
  TaskController,
  ChatController,
  EditorConnectionController,
  OnboardingController,
];

export const WORK_PROVIDERS: readonly Provider[] = [
  { provide: DISPATCHED_RUNS, useClass: DrizzleDispatchedRuns },

  {
    provide: WORK_RUN_LOOKUP,
    inject: [
      RUN_FACTS,
      RUN_LEASES,
      DISPATCHED_RUNS,
      TASK_REPOSITORY,
      CHAT_REPOSITORY,
      LINE_MAPS,
      RUN_JOURNAL_READER,
      RUN_JOURNAL_READINGS,
    ],
    useFactory: (
      facts: RunFactsPort,
      leases: RunLeasesPort,
      dispatches: DispatchedRunsPort,
      tasks: TaskRepository,
      chats: ChatRepository,
      lines: LineMapsPort,
      journals: RunJournalReaderPort,
      readings: RunJournalReadingsPort,
    ) =>
      new WorkRunLookup(
        facts,
        leases,
        dispatches,
        tasks,
        chats,
        lines,
        journals,
        readings,
      ),
  },

  {
    provide: WORK_TASK_LOOKUP,
    inject: [TASK_LOOKUP_READER, TASK_REPOSITORY, LINE_MAPS],
    useFactory: (
      readings: TaskLookupReaderPort,
      tasks: TaskRepository,
      lines: LineMapsPort,
    ) => new WorkTaskLookup(readings, tasks, lines),
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
      RUN_JOURNAL_READER,
      DISPATCH_REPOSITORY,
      RUN_JOURNAL_READINGS,
    ],
    useFactory: (
      runs: RunFactsPort,
      tasks: TaskRepository,
      journals: RunJournalReaderPort,
      dispatches: DispatchRepository,
      readings: RunJournalReadingsPort,
    ) => new RunEvidences(runs, tasks, journals, dispatches, readings),
  },

  {
    provide: RunRouting,
    inject: [TASK_PLACEMENTS, DispatchTask, CLOCK],
    useFactory: (
      placements: TaskPlacementsPort,
      dispatch: DispatchTask,
      clock: ClockPort,
    ) => new RunRouting(placements, dispatch, clock),
  },

  {
    provide: TakeTurn,
    inject: [
      RUN_TURNS,
      RUNS,
      DISPATCH_REPOSITORY,
      TASK_REPOSITORY,
      LINE_MAPS,
      RUN_JOURNAL_READER,
      TASK_VIEWS,
      LIFECYCLE_HOOKS,
      FilesLoader,
      RunRouting,
      RUN_JOURNAL_READINGS,
    ],
    useFactory: (
      turns: RunTurnsPort,
      runs: RunsPort,
      dispatches: DispatchRepository,
      tasks: TaskRepository,
      lines: LineMapsPort,
      journals: RunJournalReaderPort,
      taskViews: TaskViewsPort,
      hooks: LifecycleHooksPort,
      files: FilesLoader,
      routing: RunRouting,
      readings: RunJournalReadingsPort,
    ) =>
      new TakeTurn(
        turns,
        runs,
        dispatches,
        tasks,
        lines,
        journals,
        taskViews,
        hooks,
        files,
        routing,
        readings,
      ),
  },

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
    inject: [WorkAccess, LIVE_TASK_DRAFTS, LOGGER],
    useFactory: (
      access: WorkAccess,
      live: LiveTaskDraftsPort,
      logger: LoggerPort,
    ) => new DraftSending(access, live, logger),
  },

  TaskDraftCollab,

  DrizzleChatRepository,

  { provide: CHAT_REPOSITORY, useExisting: DrizzleChatRepository },

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
    inject: [NOTICE_REPOSITORY, WorkAccess, TRANSACTION, ID_GENERATOR, CLOCK],
    useFactory: (
      notices: NoticeRepository,
      access: WorkAccess,
      transaction: TransactionPort,
      ids: IdGeneratorPort,
      clock: ClockPort,
    ) => new Notices(notices, access, transaction, ids, clock),
  },
  {
    provide: NoticeLoader,
    inject: [NOTICE_REPOSITORY, WorkAccess],
    useFactory: (notices: NoticeRepository, access: WorkAccess) =>
      new NoticeLoader(notices, access),
  },
  { provide: NOTICES, useExisting: Notices },

  {
    provide: InboxRequestLoader,
    inject: [INBOX_REQUEST_REPOSITORY, TASK_REPOSITORY, LINE_MAPS, WorkAccess],
    useFactory: (
      inboxRequests: InboxRequestRepository,
      tasks: TaskRepository,
      lines: LineMapsPort,
      access: WorkAccess,
    ) => new InboxRequestLoader(inboxRequests, tasks, lines, access),
  },

  {
    provide: TASK_LINKS,
    inject: [ENV],
    useFactory: (env: Env) => new WebTaskLinks(publicUrlOf(env)),
  },

  {
    provide: TASK_VIEWS,
    inject: [
      TASK_REPOSITORY,
      LINE_MAPS,
      WORKSPACE_READER,
      TASK_LINKS,
      DISPATCH_REPOSITORY,
      IntegrationTaskViews,
    ],
    useFactory: (
      tasks: TaskRepository,
      lines: LineMapsPort,
      workspaces: WorkspaceReaderPort,
      links: TaskLinksPort,
      dispatches: DispatchRepository,
      views: IntegrationTaskViews,
    ) => new TaskViews(tasks, lines, workspaces, links, dispatches, views),
  },

  {
    provide: TASK_NOTES_FROM_HOOKS,
    inject: [
      TASK_REPOSITORY,
      LINE_MAPS,
      PROCESSED_EVENTS,
      TASK_PLACEMENTS,
      DispatchTask,
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
    provide: TaskRunStartGate,
    inject: [RUN_START_GATES, TASK_VIEWS, LIFECYCLE_HOOKS],
    useFactory: (
      gates: RunStartGatesPort,
      taskViews: TaskViewsPort,
      hooks: LifecycleHooksPort,
    ) => {
      const gate = new TaskRunStartGate(taskViews, hooks);

      gates.register(gate);

      return gate;
    },
  },
  {
    provide: DrizzleWorkArchiveHolders,
    inject: [ARCHIVE_HOLDERS, DRIZZLE],
    useFactory: (holders: ArchiveHoldersPort, db: DrizzleDatabase) => {
      const work = new DrizzleWorkArchiveHolders(db);

      holders.register(work);

      return work;
    },
  },
  { provide: TEAM_WELCOMES, useClass: DrizzleTeamWelcomes },
  { provide: TURN_RETAKES, useClass: DrizzleTurnRetakes },
  { provide: CHAT_READER, useClass: DrizzleChatReader },

  { provide: CHAT_MARKS, useClass: DrizzleChatMarks },

  { provide: TASK_READER, useClass: DrizzleTaskReader },

  { provide: INBOX_READER, useClass: DrizzleInboxReader },

  {
    provide: DrizzleWorkRequesterLabels,
    inject: [DRIZZLE, RUN_REQUESTER_LABELS],
    useFactory: (db: DrizzleDatabase, labels: RunRequesterLabelsPort) => {
      const source = new DrizzleWorkRequesterLabels(db);

      labels.register(source);

      return source;
    },
  },

  { provide: RUN_READER, useClass: DrizzleRunReader },

  { provide: RUNNER_TRACE_READER, useClass: DrizzleRunnerTraceReader },

  { provide: TRACED_TASK_READER, useClass: DrizzleTracedTaskReader },

  { provide: RUN_JOURNAL_READER, useClass: DrizzleRunJournalReader },

  { provide: ATTACHMENT_READER, useClass: DrizzleAttachmentReader },
  { provide: TASK_LOOKUP_READER, useClass: DrizzleTaskLookupReader },

  {
    provide: CONTROL_PLANE_RELEASE,
    inject: [ENV],
    useFactory: (env: Env): ControlPlaneReleasePort => ({
      release: env.SPOTLIGHT_RELEASE || null,
    }),
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
    inject: [ATTACHMENT_READER, ATTACHMENT_STORE],
    useFactory: (
      attachments: AttachmentReaderPort,
      files: AttachmentStorePort,
    ) => new NoteFiles(attachments, files),
  },

  {
    provide: TracesLoader,
    inject: [TRACED_TASK_READER],
    useFactory: (tasks: TracedTaskReaderPort) => new TracesLoader(tasks),
  },

  { provide: STATION_RUN_READER, useClass: DrizzleStationRunReader },

  {
    provide: STATION_RUNS,
    inject: [STATION_RUN_READER, DISPATCH_REPOSITORY],
    useFactory: (
      reader: StationRunReaderPort,
      dispatches: DispatchRepository,
    ) => new StationRuns(reader, dispatches),
  },

  {
    provide: Turns,
    inject: [
      RUN_TURNS,
      TURN_RETAKES,
      RUN_FACTS,
      RUNS,
      DISPATCH_REPOSITORY,
      TASK_REPOSITORY,
      LINE_MAPS,
      TakeTurn,
      CLOCK,
      ID_GENERATOR,
      TELEMETRY,
      LOGGER,
    ],
    useFactory: (
      turns: RunTurnsPort,
      retakes: TurnRetakesPort,
      facts: RunFactsPort,
      runs: RunsPort,
      dispatches: DispatchRepository,
      tasks: TaskRepository,
      lines: LineMapsPort,
      taking: TakeTurn,
      clock: ClockPort,
      ids: IdGeneratorPort,
      telemetry: TelemetryPort,
      logger: LoggerPort,
    ) =>
      new Turns(
        turns,
        retakes,
        facts,
        runs,
        dispatches,
        tasks,
        lines,
        taking,
        clock,
        ids,
        telemetry,
        logger,
      ),
  },

  {
    provide: TurnsWorker,
    inject: [Turns, LOGGER],
    useFactory: (turns: Turns, logger: LoggerPort) =>
      new TurnsWorker(turns, logger),
  },

  {
    provide: TeamIntegrations,
    inject: [TEAM_INTEGRATIONS],
    useFactory: (integrations: TeamIntegrationsPort) =>
      new TeamIntegrations(integrations),
  },

  {
    provide: SetupStatus,
    inject: [
      WORKSPACE_CONNECTIONS,
      RUNNER_READER,
      CHAT_READER,
      CHAT_REPOSITORY,
    ],
    useFactory: (
      connections: WorkspaceConnectionsPort,
      runners: RunnerReaderPort,
      chats: ChatReaderPort,
      chatRepository: ChatRepository,
    ) => new SetupStatus(connections, runners, chats, chatRepository),
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
    inject: [BuiltInTools, IntegrationTools, RunCatalog],
    useFactory: (
      builtIns: BuiltInTools,
      integrations: IntegrationTools,
      catalog: RunCatalog,
    ) => new ToolSources(builtIns, integrations, catalog),
  },

  {
    provide: StationSkills,
    inject: [TEAM_SKILLS],
    useFactory: (skills: TeamSkillsPort) => new StationSkills(skills),
  },

  { provide: TASK_PLACEMENTS, useClass: DrizzleTaskPlacements },

  { provide: WORK_STATIONS, useClass: DrizzleWorkStations },

  { provide: STATION_DELETION_GUARD, useClass: DrizzleStationDeletionGuard },

  {
    provide: WORK_STATION_EVENTS,
    inject: [EventSubscribers, WORK_STATIONS],
    useFactory: (subscribers: EventSubscribers, stations: WorkStationsPort) => {
      subscribers.register(
        workStationSubscribers(new ProjectLineStations(stations)),
      );
      return true;
    },
  },

  {
    provide: LINE_MAPS,
    inject: [LINES],
    useFactory: (lines: LinesPort) => new LinesLineMaps(lines),
  },

  {
    provide: LineLoader,
    inject: [WorkAccess, LINE_MAPS],
    useFactory: (access: WorkAccess, lines: LineMapsPort) =>
      new LineLoader(access, lines),
  },

  {
    provide: HAPPENING_REACTIONS,
    inject: [
      TASK_REPOSITORY,
      TASK_PLACEMENTS,
      LINE_MAPS,
      DispatchTask,
      TRANSACTION,
      CLOCK,
      ID_GENERATOR,
      MEMBER_DIRECTORY,
      ATTACHMENT_STORE,
      PROCESSED_EVENTS,
      LOGGER,
      CHAT_REPOSITORY,
      WorkAccess,
      HARNESS_LAUNCH,
      DispatchChat,
      CHANNEL_NOTICES,
      RUN_FACTS,
    ],
    useFactory: (
      tasks: TaskRepository,
      placements: TaskPlacementsPort,
      lines: LineMapsPort,
      dispatch: DispatchTask,
      transaction: TransactionPort,
      clock: ClockPort,
      ids: IdGeneratorPort,
      members: MemberDirectoryPort,
      files: AttachmentStorePort,
      processedEvents: ProcessedEventsPort,
      logger: LoggerPort,
      chats: ChatRepository,
      access: WorkAccess,
      launch: HarnessLaunchPort,
      chatDispatch: DispatchChat,
      channelNotices: ChannelNoticesPort,
      runFacts: RunFactsPort,
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
          access,
          launch,
          launch.defaultHarness(),
          chatDispatch,
          channelNotices,
          clock,
          ids,
          logger,
        ),
        runFacts,
        access,
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
    inject: [RUN_LEASES, DISPATCH_REPOSITORY, TASK_REPOSITORY],
    useFactory: (
      leases: RunLeasesPort,
      dispatches: DispatchRepository,
      tasks: TaskRepository,
    ) => new RunLoader(leases, dispatches, tasks),
  },

  {
    provide: ConversationLoader,
    inject: [TASK_REPOSITORY, LINE_MAPS, WorkAccess],
    useFactory: (
      tasks: TaskRepository,
      lines: LineMapsPort,
      access: WorkAccess,
    ) => new ConversationLoader(tasks, lines, access),
  },

  {
    provide: RunWorks,
    inject: [
      RUN_LEASES,
      RUNS,
      TASK_REPOSITORY,
      CHAT_REPOSITORY,
      LINE_MAPS,
      DISPATCH_REPOSITORY,
      CLOCK,
    ],
    useFactory: (
      leases: RunLeasesPort,
      runCommands: RunsPort,
      tasks: TaskRepository,
      chats: ChatRepository,
      lines: LineMapsPort,
      dispatches: DispatchRepository,
      clock: ClockPort,
    ) =>
      new RunWorks(leases, runCommands, tasks, chats, lines, dispatches, clock),
  },

  {
    provide: CarryGitCall,
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
    inject: [CHAT_REPOSITORY, WorkAccess],
    useFactory: (chats: ChatRepository, access: WorkAccess) =>
      new ChatLoader(chats, access),
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
    provide: DispatchChat,
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
      ChatToolExtensions,
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
      extensions: ChatToolExtensions,
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
        extensions,
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

  { provide: TRACE_PARENT, useClass: HashedTraceParent },

  {
    provide: RunsHarnessCatalogue,
    inject: [HARNESS_LAUNCH],
    useFactory: (launch: HarnessLaunchPort) => new RunsHarnessCatalogue(launch),
  },

  {
    provide: RunFiles,
    inject: [RUN_FILES, FilesLoader],
    useFactory: (sources: RunFilesPort, files: FilesLoader) => {
      const runFiles = new RunFiles(files);

      sources.register(runFiles);

      return runFiles;
    },
  },

  { provide: CONTENT_HASH, useClass: Sha256ContentHash },

  { provide: SAVEPOINT, useExisting: DrizzleContext },

  {
    provide: DispatchTask,
    inject: [
      ID_GENERATOR,
      RunsHarnessCatalogue,
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
      ids: IdGeneratorPort,
      harnesses: RunsHarnessCatalogue,
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
    provide: STATION_TRIALS,
    inject: [
      RUN_FACTS,
      DISPATCH_REPOSITORY,
      TASK_REPOSITORY,
      CandidateLines,
      RunsHarnessCatalogue,
      HARNESS_LAUNCH,
      BUILT_IN_SKILLS,
      StationSkills,
      RunCatalog,
      STATION_PROFILES,
      CONTENT_HASH,
      MEMORIES_BRIEFED_BEFORE,
      ATTACHMENT_STORE,
      TRACE_PARENT,
      RUN_EVIDENCE,
      CLOCK,
    ],
    useFactory: (
      facts: RunFactsPort,
      dispatches: DispatchRepository,
      tasks: TaskRepository,
      candidates: CandidateLines,
      harnesses: RunsHarnessCatalogue,
      launch: HarnessLaunchPort,
      skills: BuiltInSkillsPort,
      teamSkills: StationSkills,
      catalog: RunCatalog,
      profiles: StationProfilesPort,
      hash: ContentHashPort,
      memories: MemoriesBriefedBeforePort,
      files: AttachmentStorePort,
      tracing: TraceParentPort,
      evidence: RunEvidencePort,
      clock: ClockPort,
    ) =>
      new StationTrials(
        facts,
        dispatches,
        tasks,
        candidates,
        new StationOrdering(
          harnesses,
          launch,
          skills,
          teamSkills,
          catalog,
          profiles,
          hash,
        ),
        memories,
        files,
        tracing,
        evidence,
        clock,
      ),
  },

  {
    provide: CandidateLines,
    inject: [
      LINE_MAPS,
      RunCatalog,
      RunsHarnessCatalogue,
      HARNESS_LAUNCH,
      BUILT_IN_SKILLS,
      StationSkills,
      STATION_PROFILES,
      CONTENT_HASH,
    ],
    useFactory: (
      lines: LineMapsPort,
      catalog: RunCatalog,
      harnesses: RunsHarnessCatalogue,
      launch: HarnessLaunchPort,
      skills: BuiltInSkillsPort,
      teamSkills: StationSkills,
      profiles: StationProfilesPort,
      hash: ContentHashPort,
    ) =>
      new CandidateLines(
        lines,
        new StationOrdering(
          harnesses,
          launch,
          skills,
          teamSkills,
          catalog,
          profiles,
          hash,
        ),
      ),
  },

  {
    provide: STATION_CONFIG_CANDIDATES,
    inject: [CandidateLines],
    useFactory: (candidates: CandidateLines) =>
      new StationConfigCandidates(candidates),
  },

  {
    provide: TRIALABLE_RUNS,
    inject: [RUN_FACTS, TRIAL_FACTS, STATION_RUN_READER],
    useFactory: (
      runs: RunFactsPort,
      trials: TrialFactsPort,
      stationRuns: StationRunReaderPort,
    ) => new TrialableRuns(runs, trials, stationRuns),
  },

  { provide: TRIAL_FACTS, useClass: DrizzleTrialFacts },

  TraceScopes,

  { provide: TRACE_SCOPES, useExisting: TraceScopes },

  {
    provide: ChatToolExtensions,
    inject: [CHAT_REPOSITORY],
    useFactory: (chats: ChatRepository) => new ChatToolExtensions(chats),
  },

  { provide: CHAT_TOOL_EXTENSIONS, useExisting: ChatToolExtensions },

  {
    provide: HistoryAccesses,
    inject: [RUN_LEASES, DISPATCH_REPOSITORY, TraceScopes],
    useFactory: (
      leases: RunLeasesPort,
      dispatches: DispatchRepository,
      scopes: TraceScopes,
    ) => new HistoryAccesses(leases, dispatches, scopes),
  },

  {
    provide: StationRunHistories,
    inject: [
      STATION_RUN_READER,
      RUN_USAGES,
      RUN_CONNECTIONS,
      RUN_JOURNAL_READINGS,
    ],
    useFactory: (
      stations: StationRunReaderPort,
      usages: RunUsageReaderPort,
      connections: RunConnectionsPort,
      readings: RunJournalReadingsPort,
    ) => new StationRunHistories(stations, usages, connections, readings),
  },

  { provide: STATION_HISTORY, useExisting: StationRunHistories },

  {
    provide: TouchedFiles,
    inject: [
      RUN_JOURNAL_READER,
      PULL_REQUESTS,
      LOGGER,
      CLOCK,
      RUN_JOURNAL_READINGS,
    ],
    useFactory: (
      journals: RunJournalReaderPort,
      pullRequests: PullRequestPort,
      logger: LoggerPort,
      clock: ClockPort,
      readings: RunJournalReadingsPort,
    ) => new TouchedFiles(journals, pullRequests, logger, clock, readings),
  },

  {
    provide: CreateTask,
    inject: [TASK_REPOSITORY, DispatchTask, TRANSACTION, FilesLoader],
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
    provide: OutsideTaskNotices,
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
      OutsideTaskNotices,
      LINE_MAPS,
      CHAT_REPOSITORY,
      DispatchTask,
      DispatchChat,
      TRANSACTION,
      ToolUsedHooks,
      Notices,
      CHANNEL_NOTICES,
      INBOX_REQUEST_REPOSITORY,
      TASK_DRAFT_STATES,
      TEAM_WELCOMES,
      RUNS,
      DISPATCH_REPOSITORY,
      RunRouting,
      RUN_JOURNAL_READER,
      TakeTurn,
      RUN_JOURNAL_READINGS,
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
      notifier: OutsideTaskNotices,
      lines: LineMapsPort,
      chats: ChatRepository,
      taskDispatch: DispatchTask,
      chatDispatch: DispatchChat,
      transaction: TransactionPort,
      toolUsedHooks: ToolUsedHooks,
      notices: Notices,
      channelNotices: ChannelNoticesPort,
      inboxRequests: InboxRequestRepository,
      draftStates: TaskDraftStatesPort,
      welcomes: TeamWelcomesPort,
      runsFacade: RunsPort,
      dispatches: DispatchRepository,
      routing: RunRouting,
      journals: RunJournalReaderPort,
      turns: TakeTurn,
      readings: RunJournalReadingsPort,
    ) => {
      types.register('work', WORK_PAYLOAD_TYPES);
      mappers.register(WORK_EVENT_MAPPERS);
      subscribers.register([
        ...workSubscribers({
          handOver: new HandOver(tasks, lines, routing, journals, readings),
          answeredRuns: new TakeUpAnsweredRun(
            tasks,
            dispatches,
            lines,
            runsFacade,
          ),
          turns,
          chatOutcomes: new ChatOutcomes(chats, chatDispatch),
          channel: new NotifyChannel(
            chats,
            lines,
            channelNotices,
            journals,
            readings,
          ),
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

  ...bindQueryHandler(ListTaskRunsQuery, ListTaskRunsHandler, [
    RUN_READER,
    RunAccess,
  ]),

  ...bindQueryHandler(ListTeamRunsQuery, ListTeamRunsHandler, [
    RUN_READER,
    RunAccess,
  ]),

  ...bindQueryHandler(ReadTeamRunQuery, ReadTeamRunHandler, [
    RUN_READER,
    RunAccess,
  ]),

  ...bindQueryHandler(ReadRunConfigQuery, ReadRunConfigHandler, [
    RUN_READER,
    RunAccess,
  ]),

  ...bindQueryHandler(ReadRunNotesQuery, ReadRunNotesHandler, [
    RUN_READER,
    RUN_USAGES,
    RunAccess,
  ]),

  ...bindQueryHandler(ReadAttachmentQuery, ReadAttachmentHandler, [
    WorkAccess,
    ATTACHMENT_READER,
    ATTACHMENT_STORE,
  ]),

  ...bindQueryHandler(ReadRunAttachmentQuery, ReadRunAttachmentHandler, [
    RunWorks,
    ATTACHMENT_STORE,
  ]),

  ...bindQueryHandler(PendingMessagesQuery, PendingMessagesHandler, [RunWorks]),

  ...bindQueryHandler(ListChatsQuery, ListChatsHandler, [
    WorkAccess,
    CHAT_READER,
  ]),

  ...bindQueryHandler(ReadChatQuery, ReadChatHandler, [
    CHAT_READER,
    WorkAccess,
  ]),

  ...bindQueryHandler(ReadChatJournalQuery, ReadChatJournalHandler, [
    RUN_JOURNAL_READER,
    RunAccess,
  ]),

  ...bindQueryHandler(ListChatJournalRunsQuery, ListChatJournalRunsHandler, [
    RUN_JOURNAL_READER,
    RunAccess,
  ]),

  {
    provide: RunAccess,
    inject: [RUN_VIEWERS, CHAT_READER, WorkAccess],
    useFactory: (
      viewers: RunViewersPort,
      chats: ChatReaderPort,
      access: WorkAccess,
    ) => {
      const runAccess = new RunAccess(chats, access);

      viewers.register(runAccess);

      return runAccess;
    },
  },

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

  ...bindQueryHandler(ReadTaskTraceQuery, ReadTaskTraceHandler, [
    RUN_READER,
    RUN_JOURNAL_READER,
    RUN_CONNECTIONS,
    RUN_JOURNAL_READINGS,
    RunAccess,
  ]),

  ...bindQueryHandler(ReadRunnerHistoryQuery, ReadRunnerHistoryHandler, [
    HistoryAccesses,
    STATION_RUN_READER,
    RUN_RESULTS,
    RUN_USAGES,
    StationRunHistories,
  ]),

  ...bindQueryHandler(ReadRunnerTraceQuery, ReadRunnerTraceHandler, [
    HistoryAccesses,
    RUNNER_TRACE_READER,
    RUN_CONNECTIONS,
    RUN_JOURNAL_READINGS,
  ]),

  ...bindQueryHandler(ReadTaskJournalQuery, ReadTaskJournalHandler, [
    RUN_JOURNAL_READER,
    RunAccess,
  ]),

  ...bindQueryHandler(ListTaskJournalRunsQuery, ListTaskJournalRunsHandler, [
    RUN_JOURNAL_READER,
    RunAccess,
  ]),

  ...bindCommandHandler(AddTaskCommand, AddTaskHandler, [
    TASK_PLACEMENTS,
    LineLoader,
    ID_GENERATOR,
    CLOCK,
    CreateTask,
    FilesLoader,
  ]),

  ...bindCommandHandler(
    GrantAttachmentUploadCommand,
    GrantAttachmentUploadHandler,
    [WorkAccess, ATTACHMENT_STORE, ID_GENERATOR],
  ),

  ...bindCommandHandler(
    GrantRunAttachmentUploadCommand,
    GrantRunAttachmentUploadHandler,
    [RUN_LEASES, ATTACHMENT_STORE, ID_GENERATOR],
  ),

  ...bindCommandHandler(DeleteTaskCommand, DeleteTaskHandler, [
    TASK_REPOSITORY,
    LineLoader,
    TRANSACTION,
  ]),

  ...bindCommandHandler(AnswerConversationCommand, AnswerConversationHandler, [
    ConversationLoader,
    TASK_REPOSITORY,
    DispatchTask,
    TRANSACTION,
    CLOCK,
    FilesLoader,
    DraftSending,
  ]),

  ...bindQueryHandler(JoinTaskDraftQuery, JoinTaskDraftHandler, [
    TASK_WORKSPACES,
    WorkAccess,
  ]),

  ...bindCommandHandler(ConnectEditorCommand, ConnectEditorHandler, [
    TASK_WORKSPACES,
    CHAT_REPOSITORY,
    EDITOR_LEASES,
    WorkAccess,
  ]),

  ...bindQueryHandler(ReadTaskDraftQuery, ReadTaskDraftHandler, [
    TASK_DRAFT_STATES,
  ]),

  ...bindCommandHandler(KeepTaskDraftCommand, KeepTaskDraftHandler, [
    TASK_DRAFT_STATES,
  ]),

  ...bindQueryHandler(OnboardingQuery, OnboardingHandler, [
    WorkAccess,
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
      TASK_LOOKUP_READER,
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
      tasks: TaskLookupReaderPort,
      checkRuns: CheckRunsPort,
      copies: AttachmentCopies,
    ): readonly BuiltInToolUse[] => [
      new PullRequestToolUse(opening),
      new ChecksToolUse(tasks, checkRuns),
      new ProposeTaskToolUse(chats, lines, copies, clock),
      new SetupPullRequestToolUse(chats, pullRequests, transaction, clock),
      new ReviewCommentToolUse(reviewing),
      new ReviewToolUse(reviewing),
    ],
  },

  {
    provide: BuiltInTools,
    inject: [BUILT_IN_TOOL_USES, ChatToolExtensions],
    useFactory: (
      uses: readonly BuiltInToolUse[],
      extensions: ChatToolExtensions,
    ) => new BuiltInTools(uses, extensions),
  },

  {
    provide: IntegrationTools,
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

  ...bindCommandHandler(CarryGitCallCommand, CarryGitCallHandler, [
    CarryGitCall,
  ]),

  ...bindCommandHandler(UseToolCommand, UseToolHandler, [
    RunWorks,
    ToolSources,
    TASK_VIEWS,
    LIFECYCLE_HOOKS,
    ID_GENERATOR,
    TOOL_USES,
    CLOCK,
  ]),

  { provide: TOOL_USES, useClass: DrizzleToolUses },

  {
    provide: PurgeToolUses,
    inject: [TOOL_USES, CLOCK],
    useFactory: (uses: ToolUsesPort, clock: ClockPort) =>
      new PurgeToolUses(uses, clock),
  },

  {
    provide: ToolUsesWorker,
    inject: [PurgeToolUses, LOGGER],
    useFactory: (purging: PurgeToolUses, logger: LoggerPort) =>
      new ToolUsesWorker(purging, logger),
  },

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
    WorkAccess,
    CHAT_REPOSITORY,
    FilesLoader,
    TracesLoader,
    LINE_MAPS,
    DispatchChat,
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
    DispatchChat,
    CLOCK,
    TRANSACTION,
  ]),

  ...bindCommandHandler(StopChatCommand, StopChatHandler, [ChatLoader, RUNS]),

  ...bindCommandHandler(AcceptProposalCommand, AcceptProposalHandler, [
    ChatLoader,
    CHAT_REPOSITORY,
    CLOCK,
    WorkAccess,
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
    DISPATCH_REPOSITORY,
    TASK_REPOSITORY,
    LINE_MAPS,
    TRANSACTION,
    DispatchTask,
    CLOCK,
    FilesLoader,
    WorkAccess,
    DraftSending,
  ]),

  ...bindCommandHandler(StopRunCommand, StopRunHandler, [
    RUNS,
    DISPATCH_REPOSITORY,
    TASK_REPOSITORY,
    TakeTurn,
    WorkAccess,
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
    DispatchTask,
    CLOCK,
  ]),

  ...bindCommandHandler(AssignTaskCommand, AssignTaskHandler, [
    TASK_REPOSITORY,
    WorkAccess,
    TRANSACTION,
    LINE_MAPS,
  ]),
];
