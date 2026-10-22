import { ChatDispatched } from '@work/domain/events/chat-dispatched.event';
import { ChatStarted } from '@work/domain/events/chat-started.event';
import { InboxRequestCreated } from '@work/domain/events/inbox-request-created.event';
import { InboxRequestResolved } from '@work/domain/events/inbox-request-resolved.event';
import { LineCreated } from '@work/domain/events/line-created.event';
import { LineDeleted } from '@work/domain/events/line-deleted.event';
import { LineRepositoriesChanged } from '@work/domain/events/line-repositories-changed.event';
import { LineUpdated } from '@work/domain/events/line-updated.event';
import { ProposalAccepted } from '@work/domain/events/proposal-accepted.event';
import { ProposalDismissed } from '@work/domain/events/proposal-dismissed.event';
import { PullRequestOpened } from '@work/domain/events/pull-request-opened.event';
import { PullRequestReviewTaken } from '@work/domain/events/pull-request-review-taken.event';
import { ReplayRunUsageRecorded } from '@work/domain/events/replay-run-usage-recorded.event';
import { RunBriefed } from '@work/domain/events/run-briefed.event';
import { RunCancelled } from '@work/domain/events/run-cancelled.event';
import { RunCompleted } from '@work/domain/events/run-completed.event';
import { RunDetached } from '@work/domain/events/run-detached.event';
import { RunExhausted } from '@work/domain/events/run-exhausted.event';
import { RunLeaseExpired } from '@work/domain/events/run-lease-expired.event';
import { RunPaused } from '@work/domain/events/run-paused.event';
import { RunReservationDropped } from '@work/domain/events/run-reservation-dropped.event';
import { RunResumed } from '@work/domain/events/run-resumed.event';
import { RunStopRequested } from '@work/domain/events/run-stop-requested.event';
import { RunSuperseded } from '@work/domain/events/run-superseded.event';
import { RunSuspended } from '@work/domain/events/run-suspended.event';
import { RunUsageRecorded } from '@work/domain/events/run-usage-recorded.event';
import { SearchRunUsageRecorded } from '@work/domain/events/search-run-usage-recorded.event';
import { SetupPullRequestOpened } from '@work/domain/events/setup-pull-request-opened.event';
import { StationHarnessChanged } from '@work/domain/events/station-harness-changed.event';
import { StationRenamed } from '@work/domain/events/station-renamed.event';
import { TaskActedOn } from '@work/domain/events/task-acted-on.event';
import { TaskAnswered } from '@work/domain/events/task-answered.event';
import { TaskAsked } from '@work/domain/events/task-asked.event';
import { TaskDeleted } from '@work/domain/events/task-deleted.event';
import { TaskDispatched } from '@work/domain/events/task-dispatched.event';
import { TaskFailed } from '@work/domain/events/task-failed.event';
import { TaskFinished } from '@work/domain/events/task-finished.event';
import { TaskMarkReassigned } from '@work/domain/events/task-mark-reassigned.event';
import { TaskMoved } from '@work/domain/events/task-moved.event';
import { TaskOpened } from '@work/domain/events/task-opened.event';
import { TaskPassed } from '@work/domain/events/task-passed.event';
import { TaskProposed } from '@work/domain/events/task-proposed.event';
import { ToolUsed } from '@work/domain/events/tool-used.event';
import { AgentPrompt } from '@work/domain/value-objects/agent-prompt.vo';
import { Anchor } from '@work/domain/value-objects/anchor.vo';
import { Approval } from '@work/domain/value-objects/approval.vo';
import { ApprovalIntent } from '@work/domain/value-objects/approval-intent.vo';
import { ApprovalNeeded } from '@work/domain/value-objects/approval-needed.vo';
import { ApprovalSubject } from '@work/domain/value-objects/approval-subject.vo';
import { ArchiveDigest } from '@work/domain/value-objects/archive-digest.vo';
import { ArchiveSize } from '@work/domain/value-objects/archive-size.vo';
import { Attachment } from '@work/domain/value-objects/attachment.vo';
import { AttachmentId } from '@work/domain/value-objects/attachment-id.vo';
import { Branch } from '@work/domain/value-objects/branch.vo';
import { BriefedMemories } from '@work/domain/value-objects/briefed-memories.vo';
import { BriefedTask } from '@work/domain/value-objects/briefed-task.vo';
import { CalledTool } from '@work/domain/value-objects/called-tool.vo';
import { CallingHost } from '@work/domain/value-objects/calling-host.vo';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { ChatMessageBody } from '@work/domain/value-objects/chat-message-body.vo';
import { ChatTitle } from '@work/domain/value-objects/chat-title.vo';
import { ConfigFolder } from '@work/domain/value-objects/config-folder.vo';
import { ConfigSource } from '@work/domain/value-objects/config-source.vo';
import { ConnectionAsk } from '@work/domain/value-objects/connection-ask.vo';
import { ConversationId } from '@work/domain/value-objects/conversation-id.vo';
import { CorrelationKeys } from '@work/domain/value-objects/correlation-keys.vo';
import { DeclaredTool } from '@work/domain/value-objects/declared-tool.vo';
import { DeferredMove } from '@work/domain/value-objects/deferred-move.vo';
import { DeniedCatalogItem } from '@work/domain/value-objects/denied-catalog-item.vo';
import { Effort } from '@work/domain/value-objects/effort.vo';
import { Handover } from '@work/domain/value-objects/handover.vo';
import { HandoverOption } from '@work/domain/value-objects/handover-option.vo';
import { HandoverReport } from '@work/domain/value-objects/handover-report.vo';
import { Happening } from '@work/domain/value-objects/happening.vo';
import { Harness } from '@work/domain/value-objects/harness.vo';
import { HarnessCommand } from '@work/domain/value-objects/harness-command.vo';
import { HarnessName } from '@work/domain/value-objects/harness-name.vo';
import { HarnessPermission } from '@work/domain/value-objects/harness-permission.vo';
import { HarnessSession } from '@work/domain/value-objects/harness-session.vo';
import { InboxRequestId } from '@work/domain/value-objects/inbox-request-id.vo';
import { InboxRequestRead } from '@work/domain/value-objects/inbox-request-read.vo';
import { InboxRequestSubject } from '@work/domain/value-objects/inbox-request-subject.vo';
import { LineId } from '@work/domain/value-objects/line-id.vo';
import { LineKey } from '@work/domain/value-objects/line-key.vo';
import { LineName } from '@work/domain/value-objects/line-name.vo';
import { LinePlan } from '@work/domain/value-objects/line-plan.vo';
import { LineRepositories } from '@work/domain/value-objects/line-repositories.vo';
import { LineRepositoryConfig } from '@work/domain/value-objects/line-repository-config.vo';
import { LineRole } from '@work/domain/value-objects/line-role.vo';
import { Mark } from '@work/domain/value-objects/mark.vo';
import { MessagePosition } from '@work/domain/value-objects/message-position.vo';
import { Money } from '@work/domain/value-objects/money.vo';
import { NetworkCallId } from '@work/domain/value-objects/network-call-id.vo';
import { NetworkRequest } from '@work/domain/value-objects/network-request.vo';
import { NetworkResponse } from '@work/domain/value-objects/network-response.vo';
import { NotePosition } from '@work/domain/value-objects/note-position.vo';
import { NoticeId } from '@work/domain/value-objects/notice-id.vo';
import { NoticeLink } from '@work/domain/value-objects/notice-link.vo';
import { NoticeWording } from '@work/domain/value-objects/notice-wording.vo';
import { ProfileKey } from '@work/domain/value-objects/profile-key.vo';
import { ProfileMissing } from '@work/domain/value-objects/profile-missing.vo';
import { ProposalOrigin } from '@work/domain/value-objects/proposal-origin.vo';
import { ProposalPlacement } from '@work/domain/value-objects/proposal-placement.vo';
import { PullRequestLink } from '@work/domain/value-objects/pull-request-link.vo';
import { Reaction } from '@work/domain/value-objects/reaction.vo';
import { ReplayCheckPolicy } from '@work/domain/value-objects/replay-check-policy.vo';
import { ReplayRunClaim } from '@work/domain/value-objects/replay-run-claim.vo';
import { RepositorySetup } from '@work/domain/value-objects/repository-setup.vo';
import { RequeueCount } from '@work/domain/value-objects/requeue-count.vo';
import { RestoredArchive } from '@work/domain/value-objects/restored-archive.vo';
import { Resume } from '@work/domain/value-objects/resume.vo';
import { ResumeKey } from '@work/domain/value-objects/resume-key.vo';
import { ReviewComment } from '@work/domain/value-objects/review-comment.vo';
import { ReviewPolicy } from '@work/domain/value-objects/review-policy.vo';
import { RunAttempt } from '@work/domain/value-objects/run-attempt.vo';
import { RunConnection } from '@work/domain/value-objects/run-connection.vo';
import { RunFailure } from '@work/domain/value-objects/run-failure.vo';
import { RunOutcome } from '@work/domain/value-objects/run-outcome.vo';
import { RunPriority } from '@work/domain/value-objects/run-priority.vo';
import { RunSpec } from '@work/domain/value-objects/run-spec.vo';
import { RunSubject } from '@work/domain/value-objects/run-subject.vo';
import { SearchId } from '@work/domain/value-objects/search-id.vo';
import { SearchIteration } from '@work/domain/value-objects/search-iteration.vo';
import { Signing } from '@work/domain/value-objects/signing.vo';
import { SkillKey } from '@work/domain/value-objects/skill-key.vo';
import { StartedCheckout } from '@work/domain/value-objects/started-checkout.vo';
import { StartingPoint } from '@work/domain/value-objects/starting-point.vo';
import { StationAlert } from '@work/domain/value-objects/station-alert.vo';
import { StationCheck } from '@work/domain/value-objects/station-check.vo';
import { StationColor } from '@work/domain/value-objects/station-color.vo';
import { StationConfig } from '@work/domain/value-objects/station-config.vo';
import { StationDescription } from '@work/domain/value-objects/station-description.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { StationJudge } from '@work/domain/value-objects/station-judge.vo';
import { StationKey } from '@work/domain/value-objects/station-key.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { StationRoutes } from '@work/domain/value-objects/station-routes.vo';
import { TargetStation } from '@work/domain/value-objects/target-station.vo';
import { TaskDescription } from '@work/domain/value-objects/task-description.vo';
import { TaskFailure } from '@work/domain/value-objects/task-failure.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { TaskOrigin } from '@work/domain/value-objects/task-origin.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskRevision } from '@work/domain/value-objects/task-revision.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { Tokens } from '@work/domain/value-objects/tokens.vo';
import { Tool } from '@work/domain/value-objects/tool.vo';
import { ToolActingAs } from '@work/domain/value-objects/tool-acting-as.vo';
import { ToolCall } from '@work/domain/value-objects/tool-call.vo';
import { ToolInputs } from '@work/domain/value-objects/tool-inputs.vo';
import { ToolOutput } from '@work/domain/value-objects/tool-output.vo';
import { ToolRule } from '@work/domain/value-objects/tool-rule.vo';
import { ToolUse } from '@work/domain/value-objects/tool-use.vo';
import { TraceReference } from '@work/domain/value-objects/trace-reference.vo';
import { Trail } from '@work/domain/value-objects/trail.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';
import { WorkspaceArchiveId } from '@work/domain/value-objects/workspace-archive-id.vo';

export const WORK_PAYLOAD_TYPES = [
  AgentPrompt,
  Approval,
  ApprovalIntent,
  ApprovalNeeded,
  ApprovalSubject,
  ArchiveDigest,
  ArchiveSize,
  AttachmentId,
  Attachment,
  Branch,
  CallingHost,
  ChatId,
  ChatMessageBody,
  ChatTitle,
  CorrelationKeys,
  ConnectionAsk,
  Resume,
  ResumeKey,
  ConversationId,
  Handover,
  DeclaredTool,
  DeniedCatalogItem,
  Effort,
  HarnessPermission,
  ProfileKey,
  ProfileMissing,
  RequeueCount,
  HandoverOption,
  HandoverReport,
  Happening,
  Harness,
  HarnessCommand,
  HarnessName,
  HarnessSession,
  TargetStation,
  DeferredMove,
  LineId,
  LineKey,
  LineName,
  LinePlan,
  LineRepositories,
  LineRepositoryConfig,
  LineRole,
  PullRequestLink,
  RepositorySetup,
  ReplayCheckPolicy,
  ConfigFolder,
  ConfigSource,
  ReviewPolicy,
  Mark,
  MessagePosition,
  Money,
  ReplayRunClaim,
  Tokens,
  ToolUse,
  CalledTool,
  NetworkResponse,
  NetworkCallId,
  NetworkRequest,
  NotePosition,
  ProposalOrigin,
  ProposalPlacement,
  Reaction,
  ReviewComment,
  RunAttempt,
  RunConnection,
  RunOutcome,
  RunFailure,
  TaskFailure,
  RunPriority,
  RunSpec,
  RunSubject,
  Anchor,
  SearchId,
  SearchIteration,
  Signing,
  SkillKey,
  StationAlert,
  StationCheck,
  StationColor,
  StationConfig,
  StationDescription,
  StationId,
  StationJudge,
  StationKey,
  StationName,
  TaskDescription,
  TaskNoteBody,
  TaskRank,
  TaskOrigin,
  TaskRevision,
  TaskTitle,
  ToolCall,
  ToolActingAs,
  ToolInputs,
  ToolRule,
  ToolOutput,
  Tool,
  Trail,
  TraceReference,
  Voice,
  StationRoutes,
  WorkspaceArchiveId,
  InboxRequestId,
  NoticeId,
  NoticeLink,
  NoticeWording,
  InboxRequestSubject,
  InboxRequestRead,
  BriefedMemories,
  BriefedTask,
  RestoredArchive,
  StartedCheckout,
  StartingPoint,
  ChatDispatched,
  ChatStarted,
  LineRepositoriesChanged,
  LineCreated,
  LineUpdated,
  LineDeleted,
  ProposalAccepted,
  SetupPullRequestOpened,
  ProposalDismissed,
  PullRequestOpened,
  PullRequestReviewTaken,
  RunExhausted,
  RunCancelled,
  RunBriefed,
  RunSuperseded,
  RunCompleted,
  RunUsageRecorded,
  ReplayRunUsageRecorded,
  SearchRunUsageRecorded,
  TaskFailed,
  TaskPassed,
  RunLeaseExpired,
  RunSuspended,
  RunPaused,
  RunResumed,
  RunReservationDropped,
  RunStopRequested,
  StationHarnessChanged,
  StationRenamed,
  TaskActedOn,
  TaskAnswered,
  TaskAsked,
  InboxRequestCreated,
  InboxRequestResolved,
  TaskDeleted,
  TaskFinished,
  TaskDispatched,
  RunDetached,
  TaskMarkReassigned,
  TaskMoved,
  TaskOpened,
  TaskProposed,
  ToolUsed,
] as const;
