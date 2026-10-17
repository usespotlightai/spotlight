import {
  CATALOG,
  type CatalogPort,
} from '@catalog/application/ports/catalog.port';
import {
  PULL_REQUESTS,
  type PullRequestPort,
} from '@github/application/ports/pull-request.port';
import { REMARKS } from '@github/application/ports/remarks.port';
import {
  REPOSITORY_CATALOG,
  type RepositoryCatalogPort,
} from '@github/application/ports/repository-catalog.port';
import {
  REPOSITORY_GIT,
  type RepositoryGitPort,
} from '@github/application/ports/repository-git.port';
import {
  WORKSPACE_CONNECTIONS,
  type WorkspaceConnectionsPort,
} from '@github/application/ports/workspace-connections.port';
import {
  MEMBER_DIRECTORY,
  type MemberDirectoryPort,
} from '@identity/application/ports/member-directory.port';
import { PERSON_READER } from '@identity/application/ports/person-reader.port';
import {
  RUN_TOKENS,
  type RunTokensPort,
} from '@identity/application/ports/run-tokens.port';
import {
  TEAM_DIRECTORY,
  type TeamDirectoryPort,
} from '@identity/application/ports/team-directory.port';
import {
  TEAM_HOLDINGS,
  type TeamHoldingsPort,
} from '@identity/application/ports/team-holdings.port';
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
import { AuthenticatedGuard } from '@platform/http/guards/authenticated.guard';
import { RunnerGuard } from '@platform/http/guards/runner.guard';
import { CryptoIdGenerator } from '@platform/ids/crypto-id.generator';
import { RUNNER_ADMISSIONS } from '@runners/application/ports/runner-admissions.port';
import { RUNNER_EGRESS } from '@runners/application/ports/runner-egress.port';
import {
  RUNNER_POOLS,
  type RunnerPoolsPort,
} from '@runners/application/ports/runner-pools.port';
import { RUNNER_PRESENCE } from '@runners/application/ports/runner-presence.port';
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
  RUN_REDEMPTIONS,
  type RunRedemptionsPort,
} from '@secrets/application/ports/run-redemptions.port';
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
  TRANSACTION,
  type TransactionPort,
} from '@shared-kernel/application/ports/transaction.port';
import { AddTaskCommand } from '@work/application/commands/add-task.command';
import { AnswerInboxItemCommand } from '@work/application/commands/answer-inbox-item.command';
import { AnswerRemarkCommand } from '@work/application/commands/answer-remark.command';
import { AskPermissionCommand } from '@work/application/commands/ask-permission.command';
import { AssignTaskCommand } from '@work/application/commands/assign-task.command';
import {
  AcceptProposalCommand,
  DismissProposalCommand,
  SayInChatCommand,
  StartChatCommand,
  StopChatCommand,
} from '@work/application/commands/chat.commands';
import { CreateLineCommand } from '@work/application/commands/create-line.command';
import { DeleteLineCommand } from '@work/application/commands/delete-line.command';
import { DeleteTaskCommand } from '@work/application/commands/delete-task.command';
import { DeliverSaidCommand } from '@work/application/commands/deliver-said.command';
import {
  AdmitThroughEgressCommand,
  KeepEgressHoldsCommand,
  RecordEgressConnectionsCommand,
  RedeemEgressCommand,
  RedeemThroughEgressCommand,
} from '@work/application/commands/egress.commands';
import { GrantAttachmentUploadCommand } from '@work/application/commands/grant-attachment-upload.command';
import { AcceptProposalHandler } from '@work/application/commands/handlers/accept-proposal.handler';
import { AddTaskHandler } from '@work/application/commands/handlers/add-task.handler';
import { AdmitThroughEgressHandler } from '@work/application/commands/handlers/admit-through-egress.handler';
import { AnswerHostCallHandler } from '@work/application/commands/handlers/answer-host-call.handler';
import { AnswerInboxItemHandler } from '@work/application/commands/handlers/answer-inbox-item.handler';
import { AnswerRemarkHandler } from '@work/application/commands/handlers/answer-remark.handler';
import { AppendRunJournalHandler } from '@work/application/commands/handlers/append-run-journal.handler';
import { AskPermissionHandler } from '@work/application/commands/handlers/ask-permission.handler';
import { AssignTaskHandler } from '@work/application/commands/handlers/assign-task.handler';
import { ClaimHostCallHandler } from '@work/application/commands/handlers/claim-host-call.handler';
import { ClaimHostWorkHandler } from '@work/application/commands/handlers/claim-host-work.handler';
import { ClaimRunHandler } from '@work/application/commands/handlers/claim-run.handler';
import { CompleteRunHandler } from '@work/application/commands/handlers/complete-run.handler';
import { CreateLineHandler } from '@work/application/commands/handlers/create-line.handler';
import { DeleteLineHandler } from '@work/application/commands/handlers/delete-line.handler';
import { DeleteTaskHandler } from '@work/application/commands/handlers/delete-task.handler';
import { DeliverSaidHandler } from '@work/application/commands/handlers/deliver-said.handler';
import { DismissProposalHandler } from '@work/application/commands/handlers/dismiss-proposal.handler';
import { EnqueueRunHandler } from '@work/application/commands/handlers/enqueue-run.handler';
import { GrantAttachmentUploadHandler } from '@work/application/commands/handlers/grant-attachment-upload.handler';
import { GrantWorkspaceArchiveHandler } from '@work/application/commands/handlers/grant-workspace-archive.handler';
import { KeepEgressHoldsHandler } from '@work/application/commands/handlers/keep-egress-holds.handler';
import { MoveTaskHandler } from '@work/application/commands/handlers/move-task.handler';
import { ParkRunHandler } from '@work/application/commands/handlers/park-run.handler';
import { ReadInboxAsideHandler } from '@work/application/commands/handlers/read-inbox-aside.handler';
import { ReadInboxItemHandler } from '@work/application/commands/handlers/read-inbox-item.handler';
import { RecordEgressConnectionsHandler } from '@work/application/commands/handlers/record-egress-connections.handler';
import { RecordRunImageHandler } from '@work/application/commands/handlers/record-run-image.handler';
import { RecordStartingPointHandler } from '@work/application/commands/handlers/record-starting-point.handler';
import { RedeemEgressHandler } from '@work/application/commands/handlers/redeem-egress.handler';
import { RedeemThroughEgressHandler } from '@work/application/commands/handlers/redeem-through-egress.handler';
import { RenewCheckLeaseHandler } from '@work/application/commands/handlers/renew-check-lease.handler';
import { RenewLeaseHandler } from '@work/application/commands/handlers/renew-lease.handler';
import { SayInChatHandler } from '@work/application/commands/handlers/say-in-chat.handler';
import { SayToRunHandler } from '@work/application/commands/handlers/say-to-run.handler';
import { SealWorkspaceArchiveHandler } from '@work/application/commands/handlers/seal-workspace-archive.handler';
import { SettleNoticeHandler } from '@work/application/commands/handlers/settle-notice.handler';
import { StartChatHandler } from '@work/application/commands/handlers/start-chat.handler';
import { StopChatHandler } from '@work/application/commands/handlers/stop-chat.handler';
import { StopRunHandler } from '@work/application/commands/handlers/stop-run.handler';
import { UpdateLineHandler } from '@work/application/commands/handlers/update-line.handler';
import { UseToolHandler } from '@work/application/commands/handlers/use-tool.handler';
import {
  AnswerHostCallCommand,
  ClaimHostCallCommand,
} from '@work/application/commands/host-call.commands';
import { MoveTaskCommand } from '@work/application/commands/move-task.command';
import { ReadInboxAsideCommand } from '@work/application/commands/read-inbox-aside.command';
import { ReadInboxItemCommand } from '@work/application/commands/read-inbox-item.command';
import {
  AppendRunJournalCommand,
  ClaimHostWorkCommand,
  ClaimRunCommand,
  CompleteRunCommand,
  EnqueueRunCommand,
  ParkRunCommand,
  RecordRunImageCommand,
  RecordStartingPointCommand,
  RenewCheckLeaseCommand,
  RenewLeaseCommand,
} from '@work/application/commands/runner.commands';
import { SayToRunCommand } from '@work/application/commands/say-to-run.command';
import { SettleNoticeCommand } from '@work/application/commands/settle-notice.command';
import { StopRunCommand } from '@work/application/commands/stop-run.command';
import { UpdateLineCommand } from '@work/application/commands/update-line.command';
import { UseToolCommand } from '@work/application/commands/use-tool.command';
import {
  GrantWorkspaceArchiveCommand,
  SealWorkspaceArchiveCommand,
} from '@work/application/commands/workspace-archive.commands';
import { AbandonTeamLines } from '@work/application/events/handlers/abandon-team-lines.handler';
import { ChatOutcomes } from '@work/application/events/handlers/chat-outcomes.handler';
import { CreateTaskFromProposal } from '@work/application/events/handlers/create-task-from-proposal.handler';
import { DigestRun } from '@work/application/events/handlers/digest-run.handler';
import { EnqueueChatRun } from '@work/application/events/handlers/enqueue-chat-run.handler';
import { EnqueueTaskRun } from '@work/application/events/handlers/enqueue-task-run.handler';
import { HandOver } from '@work/application/events/handlers/hand-over.handler';
import { NotifyOutsideTools } from '@work/application/events/handlers/notify-outside-tools.handler';
import { ProvisionTeam } from '@work/application/events/handlers/provision-team.handler';
import { StopLetGoRun } from '@work/application/events/handlers/stop-let-go-run.handler';
import { WORK_EVENT_MAPPERS } from '@work/application/integration-events/work.event-mappers';
import type { ArchiveStandingsPort } from '@work/application/ports/archive-standings.port';
import { ARCHIVE_STANDINGS } from '@work/application/ports/archive-standings.port';
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
  BUILT_IN_SKILLS,
  type BuiltInSkillsPort,
  SHIPPED_SKILL_KEYS,
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
  CONTENT_DIGEST,
  type ContentDigestPort,
} from '@work/application/ports/content-digest.port';
import { GIT_GATEWAY } from '@work/application/ports/git-gateway.port';
import { GIVEN_AT_STATIONS } from '@work/application/ports/given-at-stations.port';
import { HAPPENING_REACTIONS } from '@work/application/ports/happening-reactions.port';
import {
  HARNESS_LAUNCH,
  type HarnessLaunchPort,
} from '@work/application/ports/harness-launch.port';
import { HARNESS_PROFILE_REVIEW } from '@work/application/ports/harness-profile-review.port';
import { HARNESS_TOOL_NAMES } from '@work/application/ports/harness-tool-names.port';
import {
  HEARD_HAPPENINGS,
  type HeardHappeningsPort,
} from '@work/application/ports/heard-happenings.port';
import { HELD_RUN_READER } from '@work/application/ports/held-run-reader.port';
import { HOOK_TRACES } from '@work/application/ports/hook-traces.port';
import {
  HOOKED_TASKS,
  type HookedTasksPort,
} from '@work/application/ports/hooked-tasks.port';
import { INBOX_READER } from '@work/application/ports/inbox-reader.port';
import {
  INTEGRATION_TOOL_CALLS,
  type IntegrationToolCallsPort,
} from '@work/application/ports/integration-tool-calls.port';
import {
  INTEGRATION_TOOLS,
  type IntegrationToolsPort,
} from '@work/application/ports/integration-tools.port';
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
  PULL_REQUEST_REVIEWING,
  type PullRequestReviewingPort,
} from '@work/application/ports/pull-request-reviewing.port';
import { QUEUED_PLACEMENTS } from '@work/application/ports/queued-placements.port';
import { REACHABLE_REPOSITORIES } from '@work/application/ports/reachable-repositories.port';
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
import {
  RUN_DIGESTS,
  type RunDigestReaderPort,
} from '@work/application/ports/run-digest-reader.port';
import {
  RUN_DIGEST_WRITER,
  type RunDigestWriterPort,
} from '@work/application/ports/run-digest-writer.port';
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
import { RUNNER_ACTIVITY_READER } from '@work/application/ports/runner-activity-reader.port';
import { RUNNER_TRACE_READER } from '@work/application/ports/runner-trace-reader.port';
import {
  SANDBOX_REACH,
  type SandboxReachPort,
} from '@work/application/ports/sandbox-reach.port';
import { SEARCH_AGENTS } from '@work/application/ports/search-agents.port';
import { SEARCH_DISPATCH } from '@work/application/ports/search-dispatch.port';
import { SEARCH_RUNS } from '@work/application/ports/search-runs.port';
import { SEARCH_SIGHT } from '@work/application/ports/search-sight.port';
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
import { TASK_ASIDES } from '@work/application/ports/task-asides.port';
import {
  TASK_DECISIONS,
  type TaskDecisionsPort,
} from '@work/application/ports/task-decisions.port';
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
import { TEAM_TRACE_READER } from '@work/application/ports/team-trace-reader.port';
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
import { HeldWorkspaceArchiveHandler } from '@work/application/queries/handlers/held-workspace-archive.handler';
import { HostRequirementsHandler } from '@work/application/queries/handlers/host-requirements.handler';
import { ImportLineHandler } from '@work/application/queries/handlers/import-line.handler';
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
import { ListTeamTracesHandler } from '@work/application/queries/handlers/list-team-traces.handler';
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
import { ReadRunConversationHandler } from '@work/application/queries/handlers/read-run-conversation.handler';
import { ReadRunEventsHandler } from '@work/application/queries/handlers/read-run-events.handler';
import { ReadRunNetworkHandler } from '@work/application/queries/handlers/read-run-network.handler';
import { ReadRunnerHistoryHandler } from '@work/application/queries/handlers/read-runner-history.handler';
import { ReadRunnerTraceHandler } from '@work/application/queries/handlers/read-runner-trace.handler';
import { ReadSearchRunHandler } from '@work/application/queries/handlers/read-search-run.handler';
import { ReadTaskJournalHandler } from '@work/application/queries/handlers/read-task-journal.handler';
import { ReadTaskTraceHandler } from '@work/application/queries/handlers/read-task-trace.handler';
import { RunStopRequestedHandler } from '@work/application/queries/handlers/run-stop-requested.handler';
import { TurnAsksAPersonHandler } from '@work/application/queries/handlers/turn-asks-a-person.handler';
import { WatchRunHandler } from '@work/application/queries/handlers/watch-run.handler';
import { HeldWorkspaceArchiveQuery } from '@work/application/queries/held-workspace-archive.query';
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
import { ListTeamTracesQuery } from '@work/application/queries/list-team-traces.query';
import { OnboardingQuery } from '@work/application/queries/onboarding.query';
import { PendingMessagesQuery } from '@work/application/queries/pending-messages.query';
import { PoolQueueQuery } from '@work/application/queries/pool.queries';
import { ReadAttachmentQuery } from '@work/application/queries/read-attachment.query';
import { ReadLineQuery } from '@work/application/queries/read-line.query';
import { ReadReplayRunQuery } from '@work/application/queries/read-replay-run.query';
import { ReadRunAttachmentQuery } from '@work/application/queries/read-run-attachment.query';
import { ReadRunConfigQuery } from '@work/application/queries/read-run-config.query';
import { ReadRunConversationQuery } from '@work/application/queries/read-run-conversation.query';
import { ReadRunEventsQuery } from '@work/application/queries/read-run-events.query';
import { ReadRunNetworkQuery } from '@work/application/queries/read-run-network.query';
import { ReadRunnerHistoryQuery } from '@work/application/queries/read-runner-history.query';
import { ReadRunnerTraceQuery } from '@work/application/queries/read-runner-trace.query';
import { ReadSearchRunQuery } from '@work/application/queries/read-search-run.query';
import { ReadTaskJournalQuery } from '@work/application/queries/read-task-journal.query';
import { ReadTaskTraceQuery } from '@work/application/queries/read-task-trace.query';
import { RunStopRequestedQuery } from '@work/application/queries/run-stop-requested.query';
import { TurnAsksAPersonQuery } from '@work/application/queries/turn-asks-a-person.query';
import { WatchRunQuery } from '@work/application/queries/watch-run.query';
import { ApplyLines } from '@work/application/services/apply-lines.service';
import { AsideLoader } from '@work/application/services/aside-loader.service';
import {
  BUILT_IN_TOOL_USES,
  BuiltInTools,
  type BuiltInToolUse,
} from '@work/application/services/built-in-tools.service';
import { CandidateLines } from '@work/application/services/candidate-lines.service';
import { CarryGitCall } from '@work/application/services/carry-git-call.service';
import { CHAT_DISPATCH } from '@work/application/services/chat-dispatch';
import { ChatLoader } from '@work/application/services/chat-loader.service';
import { ClaimsTaken } from '@work/application/services/claims-taken.service';
import { ConnectionsMade } from '@work/application/services/connections-made.service';
import { ConversationLoader } from '@work/application/services/conversation-loader.service';
import { DispatchChat } from '@work/application/services/dispatch-chat.service';
import { DispatchReplay } from '@work/application/services/dispatch-replay.service';
import { DispatchSearch } from '@work/application/services/dispatch-search.service';
import { DispatchTask } from '@work/application/services/dispatch-task.service';
import { EgressRedemptions } from '@work/application/services/egress-redemptions.service';
import { FilesLoader } from '@work/application/services/files-loader.service';
import { ForgetHeardHappenings } from '@work/application/services/forget-heard-happenings.service';
import { ForgetRunConnections } from '@work/application/services/forget-run-connections.service';
import { HoldStartingPoints } from '@work/application/services/hold-starting-points.service';
import { HookTraces } from '@work/application/services/hook-traces.service';
import { HookedTasks } from '@work/application/services/hooked-tasks.service';
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
import { RaiseTask } from '@work/application/services/raise-task';
import { ReactToHappenings } from '@work/application/services/react-to-happenings.service';
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
import { RunnerHolds } from '@work/application/services/runner-holds.service';
import { SearchRuns } from '@work/application/services/search-runs.service';
import { SettleSetup } from '@work/application/services/settle-setup.service';
import { SetupPullRequestToolUse } from '@work/application/services/setup-pull-request.tool-use';
import { SetupStanding } from '@work/application/services/setup-standing.service';
import { StationCatalog } from '@work/application/services/station-catalog.service';
import { StationOrdering } from '@work/application/services/station-ordering';
import { StationRuns } from '@work/application/services/station-runs.service';
import { StationSkills } from '@work/application/services/station-skills.service';
import { TaskAsides } from '@work/application/services/task-asides.service';
import { TaskBindings } from '@work/application/services/task-bindings.service';
import {
  TASK_DISPATCH,
  type TaskDispatching,
} from '@work/application/services/task-dispatch';
import { TeamIntegrations } from '@work/application/services/team-integrations.service';
import { ToolSources } from '@work/application/services/tool-sources.service';
import { ToolUsedHooks } from '@work/application/services/tool-used-hooks.service';
import { TouchedFiles } from '@work/application/services/touched-files';
import { TracesLoader } from '@work/application/services/traces-loader.service';
import { WorkLookup } from '@work/application/services/work-lookup.service';
import { WORK_PAYLOAD_TYPES } from '@work/domain/payload-types';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import { BUILT_IN_SKILL_KEYS } from '@work/domain/services/built-in-skills';
import { AcpHarnessToolNames } from '@work/infrastructure/acp/harness-tools';
import { OutboxTeamProvisioning } from '@work/infrastructure/events/outbox-team-provisioning';
import { GitHubReachableRepositories } from '@work/infrastructure/github/github-reachable-repositories';
import {
  BuiltInHarnesses,
  DEFAULT_HARNESS,
} from '@work/infrastructure/harnesses/built-in-harnesses';
import { Sha256ContentDigest } from '@work/infrastructure/hashing/sha256-content-digest';
import { LineCompiler } from '@work/infrastructure/lines/line.compile';
import { RowsLineRendering } from '@work/infrastructure/lines/rows-line-rendering';
import { DrizzleHeardHappenings } from '@work/infrastructure/persistence/drizzle/ledgers/heard-happenings.ledger';
import { DrizzleReplayRunClaims } from '@work/infrastructure/persistence/drizzle/ledgers/replay-run-claims.ledger';
import { DrizzleRunConnections } from '@work/infrastructure/persistence/drizzle/ledgers/run-connections.ledger';
import { DrizzleRunDigests } from '@work/infrastructure/persistence/drizzle/ledgers/run-digests.ledger';
import { DrizzleRunJournal } from '@work/infrastructure/persistence/drizzle/ledgers/run-journal.ledger';
import { DrizzleArchiveStandings } from '@work/infrastructure/persistence/drizzle/readers/archive-standings.reader';
import { DrizzleAttachmentReader } from '@work/infrastructure/persistence/drizzle/readers/attachment.reader';
import { DrizzleBriefedTasks } from '@work/infrastructure/persistence/drizzle/readers/briefed-tasks.reader';
import { DrizzleChatReader } from '@work/infrastructure/persistence/drizzle/readers/chat.reader';
import { DrizzleGivenAtStations } from '@work/infrastructure/persistence/drizzle/readers/given-at-stations.reader';
import { DrizzleHeldRunReader } from '@work/infrastructure/persistence/drizzle/readers/held-run.reader';
import { DrizzleInboxReader } from '@work/infrastructure/persistence/drizzle/readers/inbox.reader';
import { DrizzleLineReader } from '@work/infrastructure/persistence/drizzle/readers/line.reader';
import { DrizzleLineImages } from '@work/infrastructure/persistence/drizzle/readers/line-images.reader';
import { DrizzleLineResources } from '@work/infrastructure/persistence/drizzle/readers/line-resources.reader';
import { DrizzleLinesHeld } from '@work/infrastructure/persistence/drizzle/readers/lines-held.reader';
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
import { DrizzleTeamTraceReader } from '@work/infrastructure/persistence/drizzle/readers/team-trace.reader';
import { DrizzleTracedTaskReader } from '@work/infrastructure/persistence/drizzle/readers/traced-task.reader';
import { DrizzleChatRepository } from '@work/infrastructure/persistence/drizzle/repositories/chat.repository';
import { DrizzleLineRepository } from '@work/infrastructure/persistence/drizzle/repositories/line.repository';
import { DrizzleNetworkCallRepository } from '@work/infrastructure/persistence/drizzle/repositories/network-call.repository';
import { DrizzleNoticeRepository } from '@work/infrastructure/persistence/drizzle/repositories/notice.repository';
import { DrizzleRunRepository } from '@work/infrastructure/persistence/drizzle/repositories/run.repository';
import { DrizzleStartingPointHoldRepository } from '@work/infrastructure/persistence/drizzle/repositories/starting-point-hold.repository';
import { DrizzleTaskRepository } from '@work/infrastructure/persistence/drizzle/repositories/task.repository';
import { DrizzleTaskAsideRepository } from '@work/infrastructure/persistence/drizzle/repositories/task-aside.repository';
import { DrizzleWorkspaceArchiveRepository } from '@work/infrastructure/persistence/drizzle/repositories/workspace-archive.repository';
import { S3AttachmentStore } from '@work/infrastructure/storage/s3-attachment.store';
import { s3ClientsOf } from '@work/infrastructure/storage/s3-clients';
import { S3WorkspaceArchiveStore } from '@work/infrastructure/storage/s3-workspace-archive.store';
import { StorageReach } from '@work/infrastructure/storage/storage-reach';
import { InMemoryRunStream } from '@work/infrastructure/streaming/in-memory-run-stream';
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
import { HeardHappeningsWorker } from '@work/presentation/workers/heard-happenings.worker';
import { NetworkCallsWorker } from '@work/presentation/workers/network-calls.worker';
import { ProvisionWorkWorker } from '@work/presentation/workers/provision-work.worker';
import { RunConnectionsWorker } from '@work/presentation/workers/run-connections.worker';
import { WorkspaceArchivesWorker } from '@work/presentation/workers/workspace-archives.worker';

const WORK_EVENTS = Symbol('WORK_EVENTS');

const CONTROL_PLANE_HOST = Symbol('CONTROL_PLANE_HOST');

const CONTROL_PLANE_PORT = Symbol('CONTROL_PLANE_PORT');

const WORK_HOLDINGS = Symbol('WORK_HOLDINGS');

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
  { provide: GIVEN_AT_STATIONS, useClass: DrizzleGivenAtStations },
  DrizzleLinesHeld,
  {
    provide: WORK_HOLDINGS,
    inject: [TEAM_HOLDINGS, DrizzleLinesHeld],
    useFactory: (holdings: TeamHoldingsPort, lines: DrizzleLinesHeld) => {
      holdings.register(lines);
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
      CONTENT_DIGEST,
    ],
    useFactory: (
      runs: DrizzleRunRepository,
      tasks: DrizzleTaskRepository,
      lines: DrizzleLineRepository,
      journals: RunJournalReaderPort,
      briefed: BriefedTasksPort,
      digest: ContentDigestPort,
    ) => new RunEvidences(runs, tasks, lines, journals, briefed, digest),
  },

  DrizzleRunRepository,

  { provide: HEARD_HAPPENINGS, useClass: DrizzleHeardHappenings },

  DrizzleLineRepository,

  DrizzleTaskRepository,

  DrizzleChatRepository,

  DrizzleWorkspaceArchiveRepository,

  DrizzleNetworkCallRepository,

  DrizzleTaskAsideRepository,

  {
    provide: TaskAsides,
    inject: [
      DrizzleTaskAsideRepository,
      DrizzleTaskRepository,
      TRANSACTION,
      ID_GENERATOR,
      CLOCK,
    ],
    useFactory: (
      asides: DrizzleTaskAsideRepository,
      tasks: DrizzleTaskRepository,
      transaction: TransactionPort,
      ids: IdGeneratorPort,
      clock: ClockPort,
    ) => new TaskAsides(asides, tasks, transaction, ids, clock),
  },
  { provide: TASK_ASIDES, useExisting: TaskAsides },

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
    provide: AsideLoader,
    inject: [
      DrizzleTaskAsideRepository,
      DrizzleTaskRepository,
      DrizzleLineRepository,
      WORKSPACE_ACCESS,
    ],
    useFactory: (
      asides: DrizzleTaskAsideRepository,
      tasks: DrizzleTaskRepository,
      lines: DrizzleLineRepository,
      access: WorkspaceAccessPort,
    ) => new AsideLoader(asides, tasks, lines, access),
  },

  {
    provide: HookedTasks,
    inject: [
      DrizzleTaskRepository,
      DrizzleLineRepository,
      WORKSPACE_READER,
      HEARD_HAPPENINGS,
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
      heard: HeardHappeningsPort,
      placements: TaskPlacementsPort,
      dispatch: DispatchTask,
      transaction: TransactionPort,
      clock: ClockPort,
      env: Env,
    ) =>
      new HookedTasks(
        tasks,
        lines,
        workspaces,
        heard,
        placements,
        dispatch,
        transaction,
        clock,
        publicUrlOf(env),
      ),
  },

  { provide: HOOKED_TASKS, useExisting: HookedTasks },

  { provide: TASK_NOTES_FROM_HOOKS, useExisting: HookedTasks },

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
    provide: ForgetHeardHappenings,
    inject: [HEARD_HAPPENINGS, CLOCK],
    useFactory: (heard: HeardHappeningsPort, clock: ClockPort) =>
      new ForgetHeardHappenings(heard, clock),
  },

  {
    provide: HeardHappeningsWorker,
    inject: [ForgetHeardHappenings, LOGGER],
    useFactory: (forgetting: ForgetHeardHappenings, logger: LoggerPort) =>
      new HeardHappeningsWorker(forgetting, logger),
  },

  {
    provide: LongPoll,
    inject: [CLOCK, ENV],
    useFactory: (clock: ClockPort, env: Env) =>
      new LongPoll(clock, env.SPOTLIGHT_LONG_POLL_MS),
  },

  {
    provide: RunStartHooks,
    inject: [
      DrizzleRunRepository,
      HOOKED_TASKS,
      LIFECYCLE_HOOKS,
      CLOCK,
      LOGGER,
    ],
    useFactory: (
      runs: DrizzleRunRepository,
      hookedTasks: HookedTasksPort,
      hooks: LifecycleHooksPort,
      clock: ClockPort,
      logger: LoggerPort,
    ) => new RunStartHooks(runs, hookedTasks, hooks, clock, logger),
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

  { provide: ARCHIVE_STANDINGS, useClass: DrizzleArchiveStandings },
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

  { provide: TEAM_TRACE_READER, useClass: DrizzleTeamTraceReader },

  { provide: ATTACHMENT_READER, useClass: DrizzleAttachmentReader },

  {
    provide: SANDBOX_REACH,
    inject: [ENV],
    useFactory: (env: Env) => new StorageReach(env),
  },

  {
    provide: ATTACHMENT_STORE,
    inject: [ENV],
    useFactory: (env: Env) => new S3AttachmentStore(s3ClientsOf(env)),
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

  DrizzleRunDigests,

  { provide: RUN_DIGESTS, useExisting: DrizzleRunDigests },

  { provide: RUN_DIGEST_WRITER, useExisting: DrizzleRunDigests },
  { provide: RUN_TOOLS, useExisting: DrizzleRunDigests },

  { provide: RUN_SPENDS, useExisting: DrizzleRunDigests },

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

  { provide: RUN_JOURNAL, useClass: DrizzleRunJournal },

  { provide: HELD_RUN_READER, useClass: DrizzleHeldRunReader },

  {
    provide: TeamIntegrations,
    inject: [TEAM_INTEGRATIONS],
    useFactory: (integrations: TeamIntegrationsPort) =>
      new TeamIntegrations(integrations),
  },

  { provide: LINE_COMPILER, useClass: LineCompiler },

  {
    provide: SetupStanding,
    inject: [WORKSPACE_CONNECTIONS, RUNNER_READER, CHAT_READER],
    useFactory: (
      connections: WorkspaceConnectionsPort,
      runners: RunnerReaderPort,
      chats: ChatReaderPort,
    ) => new SetupStanding(connections, runners, chats),
  },

  {
    provide: REACHABLE_REPOSITORIES,
    inject: [REPOSITORY_CATALOG],
    useFactory: (catalog: RepositoryCatalogPort) =>
      new GitHubReachableRepositories(catalog),
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
      HEARD_HAPPENINGS,
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
      heard: HeardHappeningsPort,
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
        heard,
        logger,
      ),
  },

  {
    provide: SettleSetup,
    inject: [
      DrizzleTaskRepository,
      DrizzleLineRepository,
      SetupStanding,
      CLOCK,
      LOGGER,
    ],
    useFactory: (
      tasks: DrizzleTaskRepository,
      lines: LineRepository,
      setup: SetupStanding,
      clock: ClockPort,
      logger: LoggerPort,
    ) => new SettleSetup(tasks, lines, setup, clock, logger),
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
      ),
  },

  {
    provide: CreateTaskFromProposal,
    inject: [
      DrizzleChatRepository,
      DrizzleLineRepository,
      TASK_PLACEMENTS,
      RaiseTask,
      ID_GENERATOR,
      CLOCK,
    ],
    useFactory: (
      chats: DrizzleChatRepository,
      lines: DrizzleLineRepository,
      placements: TaskPlacementsPort,
      raise: RaiseTask,
      ids: IdGeneratorPort,
      clock: ClockPort,
    ) =>
      new CreateTaskFromProposal(chats, lines, placements, raise, ids, clock),
  },

  BuiltInHarnesses,

  { provide: TRACE_PARENT, useClass: HashedTraceParent },

  { provide: CONTENT_DIGEST, useClass: Sha256ContentDigest },

  {
    provide: SHIPPED_SKILL_KEYS,
    useValue: BUILT_IN_SKILL_KEYS.map((each) => each.value),
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
      CONTENT_DIGEST,
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
      digest: ContentDigestPort,
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
        digest,
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
      CONTENT_DIGEST,
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
      digest: ContentDigestPort,
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
        digest,
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
      CONTENT_DIGEST,
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
      digest: ContentDigestPort,
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
          digest,
        ),
        ids,
      ),
  },

  {
    provide: REPLAY_CANDIDATES,
    inject: [CandidateLines, LINE_RENDERING, CONTENT_DIGEST],
    useFactory: (
      candidates: CandidateLines,
      rendering: LineRenderingPort,
      digest: ContentDigestPort,
    ) => new ReplayCandidates(candidates, rendering, digest),
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
      RUN_DIGESTS,
      ID_GENERATOR,
      LOGGER,
    ],
    useFactory: (
      facts: ReplayFactsPort,
      runs: DrizzleRunRepository,
      lines: DrizzleLineRepository,
      dispatch: DispatchReplay,
      stationRuns: StationRunReaderPort,
      digests: RunDigestReaderPort,
      ids: IdGeneratorPort,
      logger: LoggerPort,
    ) =>
      new ReplayableRuns(
        facts,
        runs,
        lines,
        dispatch,
        stationRuns,
        digests,
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
    provide: RaiseTask,
    inject: [DrizzleTaskRepository, TASK_DISPATCH, TRANSACTION, FilesLoader],
    useFactory: (
      tasks: DrizzleTaskRepository,
      dispatch: DispatchTask,
      transaction: TransactionPort,
      files: FilesLoader,
    ) => new RaiseTask(tasks, dispatch, transaction, files),
  },

  {
    provide: TaskBindings,
    inject: [DrizzleLineRepository],
    useFactory: (lines: DrizzleLineRepository) => new TaskBindings(lines),
  },

  {
    provide: OUTBOUND_TASK_NOTIFIER,
    inject: [TaskBindings, TASK_NOTICES],
    useFactory: (bindings: TaskBindings, notices: TaskNoticesPort) =>
      new OutsideTaskNotices(bindings, notices),
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
      SettleSetup,
      DrizzleTaskRepository,
      OUTBOUND_TASK_NOTIFIER,
      DrizzleLineRepository,
      DrizzleRunRepository,
      DrizzleChatRepository,
      TASK_DISPATCH,
      CHAT_DISPATCH,
      RUN_DIGEST_WRITER,
      TASK_PLACEMENTS,
      TRANSACTION,
      STATION_TALLIES,
      LOGGER,
      RUN_GRANTS,
      RunnerHolds,
      ToolUsedHooks,
      RUN_JOURNAL,
      RUN_DIGESTS,
      RUN_TOOLS,
      RUN_SPENDS,
      Notices,
      RUN_TOKENS,
    ],
    useFactory: (
      types: PayloadTypes,
      mappers: IntegrationEventMappers,
      subscribers: EventSubscribers,
      provisioningLines: DrizzleLineRepository,
      ids: IdGeneratorPort,
      clock: ClockPort,
      acceptances: CreateTaskFromProposal,
      setup: SettleSetup,
      tasks: DrizzleTaskRepository,
      notifier: OutboundTaskNotifierPort,
      lines: DrizzleLineRepository,
      runs: DrizzleRunRepository,
      chats: DrizzleChatRepository,
      taskDispatch: DispatchTask,
      chatDispatch: DispatchChat,
      digests: RunDigestWriterPort,
      placements: TaskPlacementsPort,
      transaction: TransactionPort,
      tallies: StationTalliesPort,
      logger: LoggerPort,
      runGrants: RunGrantsPort,
      ending: RunnerHolds,
      toolUsedHooks: ToolUsedHooks,
      journal: RunJournalPort,
      digested: RunDigestReaderPort,
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
          digests: new DigestRun(digests, digested, tools, spends),
          provisioning: new ProvisionTeam(
            provisioningLines,
            tasks,
            ids,
            clock,
            DEFAULT_HARNESS,
          ),
          acceptances,
          outsideTools: new NotifyOutsideTools(tasks, notifier, transaction),
          taskRuns: new EnqueueTaskRun(tasks, lines, runs, taskDispatch),
          letGoRuns: new StopLetGoRun(runs, clock),
          chatRuns: new EnqueueChatRun(chats, runs, chatDispatch),
          setup,
          abandoning: new AbandonTeamLines(lines, tallies, transaction, logger),
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
    RUN_DIGESTS,
    RUN_SPENDS,
    SEARCH_AGENTS,
  ]),

  ...bindQueryHandler(ReadReplayRunQuery, ReadReplayRunHandler, [
    WORKSPACE_ACCESS,
    RUN_READER,
    RUN_JOURNAL_READER,
    RUN_DIGESTS,
  ]),

  ...bindQueryHandler(ReadRunConversationQuery, ReadRunConversationHandler, [
    RUN_READER,
    RUN_DIGESTS,
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

  ...bindQueryHandler(HeldWorkspaceArchiveQuery, HeldWorkspaceArchiveHandler, [
    DrizzleRunRepository,
    DrizzleWorkspaceArchiveRepository,
    WORKSPACE_ARCHIVE_STORE,
  ]),

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
      RUNNER_PRESENCE,
      CLOCK,
    ],
  ),

  ...bindCommandHandler(
    SealWorkspaceArchiveCommand,
    SealWorkspaceArchiveHandler,
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
      ARCHIVE_STANDINGS,
      DrizzleWorkspaceArchiveRepository,
      WORKSPACE_ARCHIVE_STORE,
      CLOCK,
      LOGGER,
    ],
    useFactory: (
      standings: ArchiveStandingsPort,
      archives: DrizzleWorkspaceArchiveRepository,
      store: WorkspaceArchiveStorePort,
      clock: ClockPort,
      logger: LoggerPort,
    ) => new RemoveReleasedArchives(standings, archives, store, clock, logger),
  },

  {
    provide: WorkspaceArchivesWorker,
    inject: [RemoveReleasedArchives, LOGGER],
    useFactory: (released: RemoveReleasedArchives, logger: LoggerPort) =>
      new WorkspaceArchivesWorker(released, logger),
  },

  ...bindQueryHandler(PendingMessagesQuery, PendingMessagesHandler, [
    DrizzleRunRepository,
    HELD_RUN_READER,
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
    HELD_RUN_READER,
  ]),

  ...bindQueryHandler(TurnAsksAPersonQuery, TurnAsksAPersonHandler, [
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
    RUNNER_ADMISSIONS,
    LINE_IMAGES,
  ]),

  ...bindQueryHandler(PoolQueueQuery, PoolQueueHandler, [
    RUNNER_POOLS,
    QUEUED_PLACEMENTS,
    CHECK_WORK,
    CLOCK,
  ]),

  { provide: QUEUED_PLACEMENTS, useClass: DrizzleQueuedPlacements },

  {
    provide: RunnerHolds,
    inject: [RUNNERS, CLOCK],
    useFactory: (runners: RunnersPort, clock: ClockPort) =>
      new RunnerHolds(runners, clock),
  },

  { provide: CHECK_ENDINGS, useExisting: RunnerHolds },

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
    ],
    useFactory: (
      runs: DrizzleRunRepository,
      checks: CheckProvisioningPort,
      pools: RunnerPoolsPort,
      runners: RunnersPort,
      failures: ProvisionFailures,
      ids: IdGeneratorPort,
      clock: ClockPort,
    ) => new ProvisionWork(runs, checks, pools, runners, failures, ids, clock),
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

  ...bindQueryHandler(ListTeamTracesQuery, ListTeamTracesHandler, [
    TEAM_TRACE_READER,
    RUN_DIGESTS,
    CLOCK,
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
    RUN_DIGESTS,
    SEARCH_SIGHT,
    RUN_CONNECTIONS,
  ]),

  ...bindQueryHandler(ReadRunnerTraceQuery, ReadRunnerTraceHandler, [
    RUNNER_TRACE_READER,
    SEARCH_SIGHT,
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
    RaiseTask,
    PERSON_READER,
    FilesLoader,
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
  ]),

  ...bindQueryHandler(OnboardingQuery, OnboardingHandler, [
    WORKSPACE_READER,
    SetupStanding,
    TEAM_PROVISIONING,
  ]),

  ...bindCommandHandler(ReadInboxAsideCommand, ReadInboxAsideHandler, [
    AsideLoader,
    DrizzleTaskAsideRepository,
    CLOCK,
  ]),
  ...bindCommandHandler(SettleNoticeCommand, SettleNoticeHandler, [
    NoticeLoader,
    DrizzleNoticeRepository,
    CLOCK,
  ]),
  ...bindCommandHandler(ReadInboxItemCommand, ReadInboxItemHandler, [
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
      HOOKED_TASKS,
      LIFECYCLE_HOOKS,
      CLOCK,
    ],
    useFactory: (
      tasks: DrizzleTaskRepository,
      lines: DrizzleLineRepository,
      pullRequests: PullRequestPort,
      transaction: TransactionPort,
      hookedTasks: HookedTasksPort,
      hooks: LifecycleHooksPort,
      clock: ClockPort,
    ) =>
      new OpenPullRequest(
        tasks,
        lines,
        pullRequests,
        transaction,
        hookedTasks,
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
      TaskBindings,
      INTEGRATION_TOOL_CALLS,
      RunWorks,
    ],
    useFactory: (
      tasks: DrizzleTaskRepository,
      lines: DrizzleLineRepository,
      bindings: TaskBindings,
      calls: IntegrationToolCallsPort,
      works: RunWorks,
    ) => new IntegrationTools(tasks, lines, bindings, calls, works),
  },

  ...bindCommandHandler(UseToolCommand, UseToolHandler, [
    RunWorks,
    ToolSources,
    HOOKED_TASKS,
    LIFECYCLE_HOOKS,
    ID_GENERATOR,
    DOMAIN_EVENT_DISPATCHER,
  ]),

  {
    provide: ToolUsedHooks,
    inject: [HOOKED_TASKS, LIFECYCLE_HOOKS],
    useFactory: (hookedTasks: HookedTasksPort, hooks: LifecycleHooksPort) =>
      new ToolUsedHooks(hookedTasks, hooks),
  },

  ...bindCommandHandler(AskPermissionCommand, AskPermissionHandler, [
    RunWorks,
    HARNESS_TOOL_NAMES,
  ]),

  ...bindCommandHandler(StartChatCommand, StartChatHandler, [
    WORKSPACE_READER,
    DrizzleChatRepository,
    FilesLoader,
    TracesLoader,
    DrizzleLineRepository,
    CHAT_DISPATCH,
    HARNESS_LAUNCH,
    REACHABLE_REPOSITORIES,
    RUNNER_READER,
    ID_GENERATOR,
    CLOCK,
    TRANSACTION,
  ]),

  ...bindCommandHandler(SayInChatCommand, SayInChatHandler, [
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

  ...bindCommandHandler(AnswerRemarkCommand, AnswerRemarkHandler, [
    RunLoader,
    DrizzleTaskRepository,
    DrizzleLineRepository,
    REMARKS,
    CLOCK,
  ]),

  ...bindCommandHandler(SayToRunCommand, SayToRunHandler, [
    DrizzleRunRepository,
    DrizzleTaskRepository,
    DrizzleLineRepository,
    TRANSACTION,
    TASK_DISPATCH,
    CLOCK,
    FilesLoader,
  ]),

  ...bindCommandHandler(StopRunCommand, StopRunHandler, [
    DrizzleRunRepository,
    DrizzleTaskRepository,
    CLOCK,
  ]),

  ...bindCommandHandler(DeliverSaidCommand, DeliverSaidHandler, [
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
    PERSON_READER,
  ]),

  ...bindCommandHandler(AssignTaskCommand, AssignTaskHandler, [
    DrizzleTaskRepository,
    TEAM_DIRECTORY,
    TRANSACTION,
    PERSON_READER,
  ]),

  ...bindCommandHandler(ClaimRunCommand, ClaimRunHandler, [
    DrizzleRunRepository,
    RunLeases,
    RUNNER_PRESENCE,
    CLOCK,
    CHECK_WORK,
    ClaimsTaken,
    ProvisionFailures,
    RunStartHooks,
    LongPoll,
  ]),

  ...bindCommandHandler(ClaimHostWorkCommand, ClaimHostWorkHandler, [
    RUNNER_ADMISSIONS,
    RUNNERS,
    RUNNER_PRESENCE,
    DrizzleRunRepository,
    RunLeases,
    CHECK_WORK,
    CLOCK,
    RunStartHooks,
    ClaimsTaken,
    LongPoll,
  ]),

  ...bindCommandHandler(ClaimHostCallCommand, ClaimHostCallHandler, [
    RUNNER_ADMISSIONS,
    RUNNERS,
    DrizzleNetworkCallRepository,
    CLOCK,
    LongPoll,
  ]),

  ...bindCommandHandler(AnswerHostCallCommand, AnswerHostCallHandler, [
    RUNNER_ADMISSIONS,
    DrizzleNetworkCallRepository,
    CLOCK,
  ]),

  {
    provide: EgressRedemptions,
    inject: [
      DrizzleRunRepository,
      RUN_REDEMPTIONS,
      RUN_GRANTS,
      SANDBOX_REACH,
      DrizzleChatRepository,
      RUN_TOKENS,
      CLOCK,
      CONTROL_PLANE_HOST,
    ],
    useFactory: (
      runs: DrizzleRunRepository,
      redemptions: RunRedemptionsPort,
      grants: RunGrantsPort,
      reach: SandboxReachPort,
      chats: DrizzleChatRepository,
      runTokens: RunTokensPort,
      clock: ClockPort,
      controlPlaneHost: string,
    ) =>
      new EgressRedemptions(
        runs,
        redemptions,
        grants,
        reach,
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
    provide: ForgetRunConnections,
    inject: [RUN_CONNECTIONS, CLOCK],
    useFactory: (connections: RunConnectionsPort, clock: ClockPort) =>
      new ForgetRunConnections(connections, clock),
  },

  {
    provide: RunConnectionsWorker,
    inject: [ForgetRunConnections, LOGGER],
    useFactory: (forgetting: ForgetRunConnections, logger: LoggerPort) =>
      new RunConnectionsWorker(forgetting, logger),
  },

  ...bindCommandHandler(RedeemEgressCommand, RedeemEgressHandler, [
    RUNNER_EGRESS,
    EgressRedemptions,
    CLOCK,
  ]),

  ...bindCommandHandler(
    RedeemThroughEgressCommand,
    RedeemThroughEgressHandler,
    [RUNNER_EGRESS, EgressRedemptions, CLOCK],
  ),

  ...bindCommandHandler(AdmitThroughEgressCommand, AdmitThroughEgressHandler, [
    RUNNER_EGRESS,
    SANDBOX_REACH,
    CLOCK,
    CONTROL_PLANE_HOST,
    CONTROL_PLANE_PORT,
  ]),

  ...bindCommandHandler(KeepEgressHoldsCommand, KeepEgressHoldsHandler, [
    RUNNER_EGRESS,
    EgressRedemptions,
    CLOCK,
  ]),

  ...bindCommandHandler(
    RecordEgressConnectionsCommand,
    RecordEgressConnectionsHandler,
    [RUNNER_EGRESS, EgressRedemptions, RUN_CONNECTIONS, CLOCK],
  ),

  ...bindCommandHandler(RenewLeaseCommand, RenewLeaseHandler, [
    DrizzleRunRepository,
    RUNNER_PRESENCE,
    CLOCK,
  ]),

  ...bindCommandHandler(ParkRunCommand, ParkRunHandler, [
    DrizzleRunRepository,
    TRANSACTION,
    CLOCK,
  ]),

  ...bindCommandHandler(RenewCheckLeaseCommand, RenewCheckLeaseHandler, [
    CHECK_WORK,
    RUNNER_PRESENCE,
    CLOCK,
  ]),

  ...bindCommandHandler(RecordRunImageCommand, RecordRunImageHandler, [
    DrizzleRunRepository,
    RUNNER_PRESENCE,
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
    HOOKED_TASKS,
    LIFECYCLE_HOOKS,
    CLOCK,
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
