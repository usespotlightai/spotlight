import { ChatDeleted } from '@work/domain/events/chat-deleted.event';
import { ChatDispatched } from '@work/domain/events/chat-dispatched.event';
import { ChatRunNotStarted } from '@work/domain/events/chat-run-not-started.event';
import { ChatStarted } from '@work/domain/events/chat-started.event';
import { DispatchBriefed } from '@work/domain/events/dispatch-briefed.event';
import { DispatchEnded } from '@work/domain/events/dispatch-ended.event';
import { DispatchOrdered } from '@work/domain/events/dispatch-ordered.event';
import { DispatchRefused } from '@work/domain/events/dispatch-refused.event';
import { DispatchSuperseded } from '@work/domain/events/dispatch-superseded.event';
import { ProposalAccepted } from '@work/domain/events/proposal-accepted.event';
import { ProposalDismissed } from '@work/domain/events/proposal-dismissed.event';
import { PullRequestOpened } from '@work/domain/events/pull-request-opened.event';
import { PullRequestReviewTaken } from '@work/domain/events/pull-request-review-taken.event';
import { RunCancelled } from '@work/domain/events/run-cancelled.event';
import { RunCompleted } from '@work/domain/events/run-completed.event';
import { RunExhausted } from '@work/domain/events/run-exhausted.event';
import { RunLeaseExpired } from '@work/domain/events/run-lease-expired.event';
import { RunPaused } from '@work/domain/events/run-paused.event';
import { RunReservationDropped } from '@work/domain/events/run-reservation-dropped.event';
import { RunSuspended } from '@work/domain/events/run-suspended.event';
import { RunUsageRecorded } from '@work/domain/events/run-usage-recorded.event';
import { SetupPullRequestOpened } from '@work/domain/events/setup-pull-request-opened.event';
import { TaskActedOn } from '@work/domain/events/task-acted-on.event';
import { TaskAnswered } from '@work/domain/events/task-answered.event';
import { TaskAsked } from '@work/domain/events/task-asked.event';
import { TaskDeleted } from '@work/domain/events/task-deleted.event';
import { TaskDispatched } from '@work/domain/events/task-dispatched.event';
import { TaskFailed } from '@work/domain/events/task-failed.event';
import { TaskFinished } from '@work/domain/events/task-finished.event';
import { TaskMarked } from '@work/domain/events/task-marked.event';
import { TaskMoved } from '@work/domain/events/task-moved.event';
import { TaskOpened } from '@work/domain/events/task-opened.event';
import { TaskPassed } from '@work/domain/events/task-passed.event';
import { TaskRunDetached } from '@work/domain/events/task-run-detached.event';
import { ToolUsed } from '@work/domain/events/tool-used.event';
import { Anchor } from '@work/domain/value-objects/anchor.vo';
import { Approval } from '@work/domain/value-objects/approval.vo';
import { ApprovalIntent } from '@work/domain/value-objects/approval-intent.vo';
import { ApprovalNeeded } from '@work/domain/value-objects/approval-needed.vo';
import { ApprovalSubject } from '@work/domain/value-objects/approval-subject.vo';
import { ArchiveDigest } from '@work/domain/value-objects/archive-digest.vo';
import { ArchiveGrantee } from '@work/domain/value-objects/archive-grantee.vo';
import { ArchiveSize } from '@work/domain/value-objects/archive-size.vo';
import { Attachment } from '@work/domain/value-objects/attachment.vo';
import { AttachmentId } from '@work/domain/value-objects/attachment-id.vo';
import { AwaitedTurn } from '@work/domain/value-objects/awaited-turn.vo';
import { Branch } from '@work/domain/value-objects/branch.vo';
import { BriefedMemories } from '@work/domain/value-objects/briefed-memories.vo';
import { BriefedTask } from '@work/domain/value-objects/briefed-task.vo';
import { CallSecretsClaim } from '@work/domain/value-objects/call-secrets-claim.vo';
import { CalledTool } from '@work/domain/value-objects/called-tool.vo';
import { CallingHost } from '@work/domain/value-objects/calling-host.vo';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { ChatMark } from '@work/domain/value-objects/chat-mark.vo';
import { ChatMessageBody } from '@work/domain/value-objects/chat-message-body.vo';
import { ChatReply } from '@work/domain/value-objects/chat-reply.vo';
import { ChatTitle } from '@work/domain/value-objects/chat-title.vo';
import { CiSetup } from '@work/domain/value-objects/ci-setup.vo';
import { CoAuthors } from '@work/domain/value-objects/co-authors.vo';
import { ConfigFolder } from '@work/domain/value-objects/config-folder.vo';
import { ConnectionAsk } from '@work/domain/value-objects/connection-ask.vo';
import { ConversationId } from '@work/domain/value-objects/conversation-id.vo';
import { CorrelationKeys } from '@work/domain/value-objects/correlation-keys.vo';
import { DeclaredTool } from '@work/domain/value-objects/declared-tool.vo';
import { DeferredMove } from '@work/domain/value-objects/deferred-move.vo';
import { DeniedCatalogItem } from '@work/domain/value-objects/denied-catalog-item.vo';
import { DiffSide } from '@work/domain/value-objects/diff-side.vo';
import { DispatchEnding } from '@work/domain/value-objects/dispatch-ending.vo';
import { DispatchOrder } from '@work/domain/value-objects/dispatch-order.vo';
import { DraftGeneration } from '@work/domain/value-objects/draft-generation.vo';
import { Handover } from '@work/domain/value-objects/handover.vo';
import { HandoverOption } from '@work/domain/value-objects/handover-option.vo';
import { HandoverReport } from '@work/domain/value-objects/handover-report.vo';
import { Harness } from '@work/domain/value-objects/harness.vo';
import { HarnessCatalogue } from '@work/domain/value-objects/harness-catalogue.vo';
import { HarnessCommand } from '@work/domain/value-objects/harness-command.vo';
import { HarnessName } from '@work/domain/value-objects/harness-name.vo';
import { HarnessPermission } from '@work/domain/value-objects/harness-permission.vo';
import { HarnessSession } from '@work/domain/value-objects/harness-session.vo';
import { HeldMark } from '@work/domain/value-objects/held-mark.vo';
import { InboxRequestId } from '@work/domain/value-objects/inbox-request-id.vo';
import { InboxRequestRead } from '@work/domain/value-objects/inbox-request-read.vo';
import { InboxRequestSubject } from '@work/domain/value-objects/inbox-request-subject.vo';
import { IntegrationName } from '@work/domain/value-objects/integration-name.vo';
import { JudgeSettings } from '@work/domain/value-objects/judge-settings.vo';
import { LineMap } from '@work/domain/value-objects/line-map.vo';
import { LineRepositories } from '@work/domain/value-objects/line-repositories.vo';
import { Mark } from '@work/domain/value-objects/mark.vo';
import { MessagePosition } from '@work/domain/value-objects/message-position.vo';
import { Money } from '@work/domain/value-objects/money.vo';
import { NetworkCallId } from '@work/domain/value-objects/network-call-id.vo';
import { NetworkRequest } from '@work/domain/value-objects/network-request.vo';
import { NetworkResponse } from '@work/domain/value-objects/network-response.vo';
import { NotePosition } from '@work/domain/value-objects/note-position.vo';
import { NoticeExternalLink } from '@work/domain/value-objects/notice-external-link.vo';
import { NoticeId } from '@work/domain/value-objects/notice-id.vo';
import { NoticeLink } from '@work/domain/value-objects/notice-link.vo';
import { NoticeSubject } from '@work/domain/value-objects/notice-subject.vo';
import { NoticeWording } from '@work/domain/value-objects/notice-wording.vo';
import { ProfileMissing } from '@work/domain/value-objects/profile-missing.vo';
import { ProposalOrigin } from '@work/domain/value-objects/proposal-origin.vo';
import { ProposalPlacement } from '@work/domain/value-objects/proposal-placement.vo';
import { PullRequestLink } from '@work/domain/value-objects/pull-request-link.vo';
import { PullRequestTitle } from '@work/domain/value-objects/pull-request-title.vo';
import { Reaction } from '@work/domain/value-objects/reaction.vo';
import { RepositoryName } from '@work/domain/value-objects/repository-name.vo';
import { RequeueCount } from '@work/domain/value-objects/requeue-count.vo';
import { RestoredArchive } from '@work/domain/value-objects/restored-archive.vo';
import { Resume } from '@work/domain/value-objects/resume.vo';
import { ReviewComment } from '@work/domain/value-objects/review-comment.vo';
import { ReviewIntake } from '@work/domain/value-objects/review-intake.vo';
import { ReviewVerdict } from '@work/domain/value-objects/review-verdict.vo';
import { RunApiGrant } from '@work/domain/value-objects/run-api-grant.vo';
import { RunAttempt } from '@work/domain/value-objects/run-attempt.vo';
import { RunConnection } from '@work/domain/value-objects/run-connection.vo';
import { RunExtensions } from '@work/domain/value-objects/run-extensions.vo';
import { RunFailure } from '@work/domain/value-objects/run-failure.vo';
import { RunOutcome } from '@work/domain/value-objects/run-outcome.vo';
import { RunPolicy } from '@work/domain/value-objects/run-policy.vo';
import { RunPriority } from '@work/domain/value-objects/run-priority.vo';
import {
  RequesterOwner,
  RunRequester,
} from '@work/domain/value-objects/run-requester.vo';
import { RunSpec } from '@work/domain/value-objects/run-spec.vo';
import { RunTags } from '@work/domain/value-objects/run-tags.vo';
import { RunTurn } from '@work/domain/value-objects/run-turn.vo';
import { RunUsage } from '@work/domain/value-objects/run-usage.vo';
import { Signing } from '@work/domain/value-objects/signing.vo';
import { SpotlightApiGrant } from '@work/domain/value-objects/spotlight-api-grant.vo';
import { StartedCheckout } from '@work/domain/value-objects/started-checkout.vo';
import { StartingPoint } from '@work/domain/value-objects/starting-point.vo';
import { Station } from '@work/domain/value-objects/station.vo';
import { StationConfig } from '@work/domain/value-objects/station-config.vo';
import { TargetStation } from '@work/domain/value-objects/target-station.vo';
import { TaskDescription } from '@work/domain/value-objects/task-description.vo';
import { TaskFailure } from '@work/domain/value-objects/task-failure.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { TaskOrigin } from '@work/domain/value-objects/task-origin.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskRevision } from '@work/domain/value-objects/task-revision.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { TeamMembers } from '@work/domain/value-objects/team-members.vo';
import { TeamStanding } from '@work/domain/value-objects/team-standing.vo';
import { Tokens } from '@work/domain/value-objects/tokens.vo';
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
import {
  RunWorkspace,
  WorkspaceKey,
} from '@work/domain/value-objects/workspace-key.vo';

export const WORK_PAYLOAD_TYPES = [
  JudgeSettings,
  LineMap,
  LineRepositories,
  Reaction,
  ReviewIntake,
  Station,
  Approval,
  ApprovalIntent,
  ApprovalNeeded,
  ApprovalSubject,
  ArchiveDigest,
  ArchiveGrantee,
  ArchiveSize,
  AttachmentId,
  Attachment,
  Branch,
  CallSecretsClaim,
  CallingHost,
  ChatId,
  ChatMessageBody,
  ChatTitle,
  CorrelationKeys,
  ConnectionAsk,
  Resume,
  ConversationId,
  Handover,
  DeclaredTool,
  DeniedCatalogItem,
  HarnessPermission,
  ProfileMissing,
  RequeueCount,
  HandoverOption,
  HandoverReport,
  Harness,
  HarnessCommand,
  HarnessName,
  HarnessSession,
  TargetStation,
  DeferredMove,
  PullRequestLink,
  PullRequestTitle,
  CiSetup,
  ConfigFolder,
  Mark,
  DiffSide,
  HeldMark,
  NoticeSubject,
  ReviewVerdict,
  ChatMark,
  ChatReply,
  MessagePosition,
  Money,
  Tokens,
  ToolUse,
  RunUsage,
  CalledTool,
  NetworkResponse,
  NetworkCallId,
  NetworkRequest,
  NotePosition,
  ProposalOrigin,
  ProposalPlacement,
  ReviewComment,
  RunAttempt,
  RunApiGrant,
  RunExtensions,
  RunTags,
  RunWorkspace,
  WorkspaceKey,
  RunConnection,
  RunOutcome,
  RunFailure,
  TaskFailure,
  RunPriority,
  RunSpec,
  Anchor,
  Signing,
  StationConfig,
  TaskDescription,
  TaskNoteBody,
  TaskRank,
  TaskOrigin,
  TaskRevision,
  TaskTitle,
  TeamMembers,
  TeamStanding,
  ToolCall,
  ToolActingAs,
  ToolInputs,
  ToolRule,
  ToolOutput,
  Trail,
  TraceReference,
  Voice,
  DraftGeneration,
  WorkspaceArchiveId,
  InboxRequestId,
  NoticeId,
  NoticeLink,
  NoticeExternalLink,
  NoticeWording,
  InboxRequestSubject,
  IntegrationName,
  HarnessCatalogue,
  RepositoryName,
  InboxRequestRead,
  BriefedMemories,
  BriefedTask,
  RestoredArchive,
  StartedCheckout,
  StartingPoint,
  ChatDeleted,
  CoAuthors,
  SpotlightApiGrant,
  ChatDispatched,
  ChatRunNotStarted,
  ChatStarted,
  ProposalAccepted,
  SetupPullRequestOpened,
  ProposalDismissed,
  PullRequestOpened,
  PullRequestReviewTaken,
  RunExhausted,
  RunCancelled,
  DispatchBriefed,
  DispatchEnded,
  DispatchOrdered,
  DispatchRefused,
  DispatchSuperseded,
  DispatchEnding,
  DispatchOrder,
  RunPolicy,
  RunTurn,
  AwaitedTurn,
  RequesterOwner,
  RunRequester,
  RunCompleted,
  RunUsageRecorded,
  TaskFailed,
  TaskPassed,
  RunLeaseExpired,
  RunSuspended,
  RunPaused,
  RunReservationDropped,
  TaskActedOn,
  TaskAnswered,
  TaskAsked,
  TaskDeleted,
  TaskFinished,
  TaskDispatched,
  TaskRunDetached,
  TaskMarked,
  TaskMoved,
  TaskOpened,
  ToolUsed,
] as const;
