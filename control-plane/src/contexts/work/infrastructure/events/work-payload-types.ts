import { ChatCiSetUp } from '@work/domain/events/chat-ci-set-up.event';
import { ChatDeleted } from '@work/domain/events/chat-deleted.event';
import { ChatHeardFromTask } from '@work/domain/events/chat-heard-from-task.event';
import { ChatMessageSent } from '@work/domain/events/chat-message-sent.event';
import { ChatMessagesAcknowledged } from '@work/domain/events/chat-messages-acknowledged.event';
import { ChatPullRequestOpened } from '@work/domain/events/chat-pull-request-opened.event';
import { ChatResolved } from '@work/domain/events/chat-resolved.event';
import { ChatRunAssigned } from '@work/domain/events/chat-run-assigned.event';
import { ChatRunEnded } from '@work/domain/events/chat-run-ended.event';
import { ChatRunNotStarted } from '@work/domain/events/chat-run-not-started.event';
import { ChatStarted } from '@work/domain/events/chat-started.event';
import { DispatchBriefed } from '@work/domain/events/dispatch-briefed.event';
import { DispatchEnded } from '@work/domain/events/dispatch-ended.event';
import { DispatchOrdered } from '@work/domain/events/dispatch-ordered.event';
import { DispatchRefused } from '@work/domain/events/dispatch-refused.event';
import { DispatchSuperseded } from '@work/domain/events/dispatch-superseded.event';
import { InboxRequestMarkedRead } from '@work/domain/events/inbox-request-marked-read.event';
import { InboxRequestOpened } from '@work/domain/events/inbox-request-opened.event';
import { InboxRequestReopened } from '@work/domain/events/inbox-request-reopened.event';
import { InboxRequestResolved } from '@work/domain/events/inbox-request-resolved.event';
import { LineResumed } from '@work/domain/events/line-resumed.event';
import { NoticeRaised } from '@work/domain/events/notice-raised.event';
import { NoticeReopened } from '@work/domain/events/notice-reopened.event';
import { NoticeResolved } from '@work/domain/events/notice-resolved.event';
import { ProposalAcceptanceFailed } from '@work/domain/events/proposal-acceptance-failed.event';
import { ProposalAccepted } from '@work/domain/events/proposal-accepted.event';
import { ProposalBecameTask } from '@work/domain/events/proposal-became-task.event';
import { ProposalDismissed } from '@work/domain/events/proposal-dismissed.event';
import { ProposalRestored } from '@work/domain/events/proposal-restored.event';
import { ProposalsReplaced } from '@work/domain/events/proposals-replaced.event';
import { PullRequestOpened } from '@work/domain/events/pull-request-opened.event';
import { PullRequestReviewTaken } from '@work/domain/events/pull-request-review-taken.event';
import { SetupPullRequestMerged } from '@work/domain/events/setup-pull-request-merged.event';
import { SetupPullRequestOpened } from '@work/domain/events/setup-pull-request-opened.event';
import { TaskActedOn } from '@work/domain/events/task-acted-on.event';
import { TaskAnswered } from '@work/domain/events/task-answered.event';
import { TaskApprovalClaimed } from '@work/domain/events/task-approval-claimed.event';
import { TaskApprovalReturned } from '@work/domain/events/task-approval-returned.event';
import { TaskAsked } from '@work/domain/events/task-asked.event';
import { TaskAssigned } from '@work/domain/events/task-assigned.event';
import { TaskBaseMoved } from '@work/domain/events/task-base-moved.event';
import { TaskConversationRead } from '@work/domain/events/task-conversation-read.event';
import { TaskConversationReopened } from '@work/domain/events/task-conversation-reopened.event';
import { TaskDeleted } from '@work/domain/events/task-deleted.event';
import { TaskDraftSent } from '@work/domain/events/task-draft-sent.event';
import { TaskFailed } from '@work/domain/events/task-failed.event';
import { TaskFinished } from '@work/domain/events/task-finished.event';
import { TaskHeld } from '@work/domain/events/task-held.event';
import { TaskMarkReleased } from '@work/domain/events/task-mark-released.event';
import { TaskMarked } from '@work/domain/events/task-marked.event';
import { TaskMoved } from '@work/domain/events/task-moved.event';
import { TaskNotedForChat } from '@work/domain/events/task-noted-for-chat.event';
import { TaskNoted } from '@work/domain/events/task-noted.event';
import { TaskNotesAcknowledged } from '@work/domain/events/task-notes-acknowledged.event';
import { TaskOpened } from '@work/domain/events/task-opened.event';
import { TaskPassed } from '@work/domain/events/task-passed.event';
import { TaskProposed } from '@work/domain/events/task-proposed.event';
import { TaskPullRequestClosed } from '@work/domain/events/task-pull-request-closed.event';
import { TaskPullRequestReopened } from '@work/domain/events/task-pull-request-reopened.event';
import { TaskReordered } from '@work/domain/events/task-reordered.event';
import { TaskRunAssigned } from '@work/domain/events/task-run-assigned.event';
import { TaskRunDetached } from '@work/domain/events/task-run-detached.event';
import { TaskRunEnded } from '@work/domain/events/task-run-ended.event';
import { TaskSessionKept } from '@work/domain/events/task-session-kept.event';
import { TaskTurnAwaited } from '@work/domain/events/task-turn-awaited.event';
import { ToolUsed } from '@work/domain/events/tool-used.event';
import { Anchor } from '@work/domain/value-objects/anchor.vo';
import { AppGrants } from '@work/domain/value-objects/app-grants.vo';
import { ApprovalIntent } from '@work/domain/value-objects/approval-intent.vo';
import { ApprovalNeeded } from '@work/domain/value-objects/approval-needed.vo';
import { ApprovalSubject } from '@work/domain/value-objects/approval-subject.vo';
import { Approval } from '@work/domain/value-objects/approval.vo';
import { AttachmentId } from '@work/domain/value-objects/attachment-id.vo';
import { Attachment } from '@work/domain/value-objects/attachment.vo';
import { AwaitedTurn } from '@work/domain/value-objects/awaited-turn.vo';
import { Branch } from '@work/domain/value-objects/branch.vo';
import { BriefedMemories } from '@work/domain/value-objects/briefed-memories.vo';
import { BriefedTask } from '@work/domain/value-objects/briefed-task.vo';
import { CalledTool } from '@work/domain/value-objects/called-tool.vo';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { ChatMark } from '@work/domain/value-objects/chat-mark.vo';
import { ChatMessageBody } from '@work/domain/value-objects/chat-message-body.vo';
import { ChatPullRequest } from '@work/domain/value-objects/chat-pull-request.vo';
import { ChatReply } from '@work/domain/value-objects/chat-reply.vo';
import { ChatTitle } from '@work/domain/value-objects/chat-title.vo';
import { CiSetup } from '@work/domain/value-objects/ci-setup.vo';
import { CoAuthors } from '@work/domain/value-objects/co-authors.vo';
import { CommitSha } from '@work/domain/value-objects/commit-sha.vo';
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
import { HandoverOption } from '@work/domain/value-objects/handover-option.vo';
import { Handover } from '@work/domain/value-objects/handover.vo';
import { HarnessCatalogue } from '@work/domain/value-objects/harness-catalogue.vo';
import { HarnessPermission } from '@work/domain/value-objects/harness-permission.vo';
import { HarnessSession } from '@work/domain/value-objects/harness-session.vo';
import { HeldMark } from '@work/domain/value-objects/held-mark.vo';
import { HistoryAccess } from '@work/domain/value-objects/history-access.vo';
import { HoldId } from '@work/domain/value-objects/hold-id.vo';
import { InboxRequestAsks } from '@work/domain/value-objects/inbox-request-asks.vo';
import { InboxRequestId } from '@work/domain/value-objects/inbox-request-id.vo';
import { InboxRequestRead } from '@work/domain/value-objects/inbox-request-read.vo';
import { InboxRequestSubject } from '@work/domain/value-objects/inbox-request-subject.vo';
import { IntegrationName } from '@work/domain/value-objects/integration-name.vo';
import { JudgeSettings } from '@work/domain/value-objects/judge-settings.vo';
import { LineMap } from '@work/domain/value-objects/line-map.vo';
import { LineRepositories } from '@work/domain/value-objects/line-repositories.vo';
import { Mark } from '@work/domain/value-objects/mark.vo';
import { MessagePosition } from '@work/domain/value-objects/message-position.vo';
import { NotePosition } from '@work/domain/value-objects/note-position.vo';
import { NoticeExternalLink } from '@work/domain/value-objects/notice-external-link.vo';
import { NoticeId } from '@work/domain/value-objects/notice-id.vo';
import { NoticeLink } from '@work/domain/value-objects/notice-link.vo';
import { NoticeSubject } from '@work/domain/value-objects/notice-subject.vo';
import { NoticeWording } from '@work/domain/value-objects/notice-wording.vo';
import { OwnedPullRequest } from '@work/domain/value-objects/owned-pull-request.vo';
import { ProfileMissing } from '@work/domain/value-objects/profile-missing.vo';
import { ProposalOrigin } from '@work/domain/value-objects/proposal-origin.vo';
import { ProposalPlacement } from '@work/domain/value-objects/proposal-placement.vo';
import { PullRequestTitle } from '@work/domain/value-objects/pull-request-title.vo';
import { PushedHead } from '@work/domain/value-objects/pushed-head.vo';
import { Reaction } from '@work/domain/value-objects/reaction.vo';
import { RefUpdate } from '@work/domain/value-objects/ref-update.vo';
import { RepositoriesMissing } from '@work/domain/value-objects/repositories-missing.vo';
import { RepositoryName } from '@work/domain/value-objects/repository-name.vo';
import { RequestedBase } from '@work/domain/value-objects/requested-base.vo';
import { Resume } from '@work/domain/value-objects/resume.vo';
import { Resumption } from '@work/domain/value-objects/resumption.vo';
import { ReviewComment } from '@work/domain/value-objects/review-comment.vo';
import { ReviewIntake } from '@work/domain/value-objects/review-intake.vo';
import { ReviewRequest } from '@work/domain/value-objects/review-request.vo';
import { ReviewVerdict } from '@work/domain/value-objects/review-verdict.vo';
import { ReviewedPullRequest } from '@work/domain/value-objects/reviewed-pull-request.vo';
import { RunNotStarted } from '@work/domain/value-objects/run-not-started.vo';
import { RunPriority } from '@work/domain/value-objects/run-priority.vo';
import { RunResult } from '@work/domain/value-objects/run-result.vo';
import { SecretAwaitingValue } from '@work/domain/value-objects/secret-awaiting-value.vo';
import { SecretSandboxNotAllowed } from '@work/domain/value-objects/secret-sandbox-not-allowed.vo';
import { StationConfig } from '@work/domain/value-objects/station-config.vo';
import { Station } from '@work/domain/value-objects/station.vo';
import { TargetStation } from '@work/domain/value-objects/target-station.vo';
import { TaskDescription } from '@work/domain/value-objects/task-description.vo';
import { TaskFailure } from '@work/domain/value-objects/task-failure.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { TaskOrigin } from '@work/domain/value-objects/task-origin.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskRevision } from '@work/domain/value-objects/task-revision.vo';
import { TaskSearch } from '@work/domain/value-objects/task-search.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { TeamMembers } from '@work/domain/value-objects/team-members.vo';
import { TeamStanding } from '@work/domain/value-objects/team-standing.vo';
import { ToolActingAs } from '@work/domain/value-objects/tool-acting-as.vo';
import { ToolCall } from '@work/domain/value-objects/tool-call.vo';
import { ToolInputs } from '@work/domain/value-objects/tool-inputs.vo';
import { ToolOutput } from '@work/domain/value-objects/tool-output.vo';
import { ToolRule } from '@work/domain/value-objects/tool-rule.vo';
import { TraceReference } from '@work/domain/value-objects/trace-reference.vo';
import { Trail } from '@work/domain/value-objects/trail.vo';
import { TurnHeads } from '@work/domain/value-objects/turn-heads.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';
import { WorkingCopyRelease } from '@work/domain/value-objects/working-copy-release.vo';

export const WORK_PAYLOAD_TYPES = [
  RunResult,
  JudgeSettings,
  LineMap,
  LineRepositories,
  Reaction,
  RefUpdate,
  ReviewIntake,
  Station,
  Approval,
  ApprovalIntent,
  ApprovalNeeded,
  ApprovalSubject,
  AttachmentId,
  Attachment,
  Branch,
  RequestedBase,
  CommitSha,
  ChatId,
  ChatPullRequest,
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
  RepositoriesMissing,
  SecretAwaitingValue,
  SecretSandboxNotAllowed,
  HandoverOption,
  Resumption,
  RunNotStarted,
  HarnessSession,
  TargetStation,
  DeferredMove,
  ReviewedPullRequest,
  OwnedPullRequest,
  PushedHead,
  PullRequestTitle,
  CiSetup,
  AppGrants,
  ConfigFolder,
  Mark,
  DiffSide,
  HeldMark,
  NoticeSubject,
  ReviewVerdict,
  ChatMark,
  ChatReply,
  MessagePosition,
  CalledTool,
  NotePosition,
  ProposalOrigin,
  ProposalPlacement,
  ReviewComment,
  TaskFailure,
  RunPriority,
  Anchor,
  StationConfig,
  TaskDescription,
  TaskNoteBody,
  TaskRank,
  TaskOrigin,
  TaskRevision,
  TaskSearch,
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
  InboxRequestAsks,
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
  ChatDeleted,
  CoAuthors,
  ChatRunAssigned,
  ChatRunNotStarted,
  ChatCiSetUp,
  ChatHeardFromTask,
  ChatPullRequestOpened,
  ChatMessageSent,
  ChatMessagesAcknowledged,
  ChatRunEnded,
  ChatResolved,
  ProposalAcceptanceFailed,
  ProposalBecameTask,
  TaskProposed,
  ChatStarted,
  ProposalAccepted,
  SetupPullRequestOpened,
  SetupPullRequestMerged,
  ProposalDismissed,
  ProposalRestored,
  ProposalsReplaced,
  PullRequestOpened,
  PullRequestReviewTaken,
  DispatchBriefed,
  DispatchEnded,
  DispatchOrdered,
  DispatchRefused,
  DispatchSuperseded,
  DispatchEnding,
  DispatchOrder,
  WorkingCopyRelease,
  AwaitedTurn,
  HistoryAccess,
  ReviewRequest,
  TaskFailed,
  TaskNoted,
  TaskReordered,
  TaskPullRequestClosed,
  TaskBaseMoved,
  TaskPullRequestReopened,
  TaskConversationRead,
  TaskNotesAcknowledged,
  TaskRunEnded,
  TaskSessionKept,
  TaskDraftSent,
  TaskMarkReleased,
  TaskApprovalReturned,
  TaskApprovalClaimed,
  TaskTurnAwaited,
  TaskPassed,
  TaskActedOn,
  TaskHeld,
  TaskNotedForChat,
  LineResumed,
  HoldId,
  TurnHeads,
  TaskAnswered,
  TaskAsked,
  TaskAssigned,
  TaskConversationReopened,
  InboxRequestOpened,
  InboxRequestReopened,
  NoticeRaised,
  NoticeReopened,
  NoticeResolved,
  InboxRequestResolved,
  InboxRequestMarkedRead,
  TaskDeleted,
  TaskFinished,
  TaskRunAssigned,
  TaskRunDetached,
  TaskMarked,
  TaskMoved,
  TaskOpened,
  ToolUsed,
] as const;
