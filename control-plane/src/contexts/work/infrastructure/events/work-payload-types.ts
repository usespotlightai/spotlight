import { ChatDeleted } from '@work/domain/events/chat-deleted.event';
import { ChatRunAssigned } from '@work/domain/events/chat-run-assigned.event';
import { ChatRunNotStarted } from '@work/domain/events/chat-run-not-started.event';
import { ChatStarted } from '@work/domain/events/chat-started.event';
import { DispatchBriefed } from '@work/domain/events/dispatch-briefed.event';
import { DispatchEnded } from '@work/domain/events/dispatch-ended.event';
import { DispatchOrdered } from '@work/domain/events/dispatch-ordered.event';
import { DispatchRefused } from '@work/domain/events/dispatch-refused.event';
import { DispatchSuperseded } from '@work/domain/events/dispatch-superseded.event';
import { InboxItemArrived } from '@work/domain/events/inbox-item-arrived.event';
import { InboxRequestOpened } from '@work/domain/events/inbox-request-opened.event';
import { NoticeRaised } from '@work/domain/events/notice-raised.event';
import { ProposalAccepted } from '@work/domain/events/proposal-accepted.event';
import { ProposalDismissed } from '@work/domain/events/proposal-dismissed.event';
import { PullRequestOpened } from '@work/domain/events/pull-request-opened.event';
import { PullRequestReviewTaken } from '@work/domain/events/pull-request-review-taken.event';
import { SetupPullRequestOpened } from '@work/domain/events/setup-pull-request-opened.event';
import { TaskActedOn } from '@work/domain/events/task-acted-on.event';
import { TaskAnswered } from '@work/domain/events/task-answered.event';
import { TaskAsked } from '@work/domain/events/task-asked.event';
import { TaskAssigned } from '@work/domain/events/task-assigned.event';
import { TaskConversationReopened } from '@work/domain/events/task-conversation-reopened.event';
import { TaskDeleted } from '@work/domain/events/task-deleted.event';
import { TaskFailed } from '@work/domain/events/task-failed.event';
import { TaskFinished } from '@work/domain/events/task-finished.event';
import { TaskMarked } from '@work/domain/events/task-marked.event';
import { TaskMoved } from '@work/domain/events/task-moved.event';
import { TaskOpened } from '@work/domain/events/task-opened.event';
import { TaskPassed } from '@work/domain/events/task-passed.event';
import { TaskRunAssigned } from '@work/domain/events/task-run-assigned.event';
import { TaskRunDetached } from '@work/domain/events/task-run-detached.event';
import { ToolUsed } from '@work/domain/events/tool-used.event';
import { Anchor } from '@work/domain/value-objects/anchor.vo';
import { Approval } from '@work/domain/value-objects/approval.vo';
import { ApprovalIntent } from '@work/domain/value-objects/approval-intent.vo';
import { ApprovalNeeded } from '@work/domain/value-objects/approval-needed.vo';
import { ApprovalSubject } from '@work/domain/value-objects/approval-subject.vo';
import { Attachment } from '@work/domain/value-objects/attachment.vo';
import { AttachmentId } from '@work/domain/value-objects/attachment-id.vo';
import { AwaitedTurn } from '@work/domain/value-objects/awaited-turn.vo';
import { Branch } from '@work/domain/value-objects/branch.vo';
import { BriefedMemories } from '@work/domain/value-objects/briefed-memories.vo';
import { BriefedTask } from '@work/domain/value-objects/briefed-task.vo';
import { CalledTool } from '@work/domain/value-objects/called-tool.vo';
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
import { HarnessCatalogue } from '@work/domain/value-objects/harness-catalogue.vo';
import { HarnessPermission } from '@work/domain/value-objects/harness-permission.vo';
import { HarnessSession } from '@work/domain/value-objects/harness-session.vo';
import { HeldMark } from '@work/domain/value-objects/held-mark.vo';
import { HistoryAccess } from '@work/domain/value-objects/history-access.vo';
import { InboxRequestId } from '@work/domain/value-objects/inbox-request-id.vo';
import { InboxRequestRead } from '@work/domain/value-objects/inbox-request-read.vo';
import { InboxRequestSubject } from '@work/domain/value-objects/inbox-request-subject.vo';
import { IntegrationName } from '@work/domain/value-objects/integration-name.vo';
import { JudgeSettings } from '@work/domain/value-objects/judge-settings.vo';
import { LaterPullRequest } from '@work/domain/value-objects/later-pull-request.vo';
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
import { ProfileMissing } from '@work/domain/value-objects/profile-missing.vo';
import { ProposalOrigin } from '@work/domain/value-objects/proposal-origin.vo';
import { ProposalPlacement } from '@work/domain/value-objects/proposal-placement.vo';
import { PullRequestLink } from '@work/domain/value-objects/pull-request-link.vo';
import { PullRequestTitle } from '@work/domain/value-objects/pull-request-title.vo';
import { Reaction } from '@work/domain/value-objects/reaction.vo';
import { RepositoryName } from '@work/domain/value-objects/repository-name.vo';
import { Resume } from '@work/domain/value-objects/resume.vo';
import { ReviewComment } from '@work/domain/value-objects/review-comment.vo';
import { ReviewIntake } from '@work/domain/value-objects/review-intake.vo';
import { ReviewRequest } from '@work/domain/value-objects/review-request.vo';
import { ReviewVerdict } from '@work/domain/value-objects/review-verdict.vo';
import { RunPriority } from '@work/domain/value-objects/run-priority.vo';
import { RunResult } from '@work/domain/value-objects/run-result.vo';
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
import { ToolActingAs } from '@work/domain/value-objects/tool-acting-as.vo';
import { ToolCall } from '@work/domain/value-objects/tool-call.vo';
import { ToolInputs } from '@work/domain/value-objects/tool-inputs.vo';
import { ToolOutput } from '@work/domain/value-objects/tool-output.vo';
import { ToolRule } from '@work/domain/value-objects/tool-rule.vo';
import { TraceReference } from '@work/domain/value-objects/trace-reference.vo';
import { Trail } from '@work/domain/value-objects/trail.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';
import { WorkingCopyRelease } from '@work/domain/value-objects/working-copy-release.vo';

export const WORK_PAYLOAD_TYPES = [
  RunResult,
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
  AttachmentId,
  Attachment,
  Branch,
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
  HandoverOption,
  HarnessSession,
  TargetStation,
  DeferredMove,
  PullRequestLink,
  LaterPullRequest,
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
  ChatStarted,
  ProposalAccepted,
  SetupPullRequestOpened,
  ProposalDismissed,
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
  TaskPassed,
  TaskActedOn,
  TaskAnswered,
  TaskAsked,
  TaskAssigned,
  TaskConversationReopened,
  InboxRequestOpened,
  NoticeRaised,
  InboxItemArrived,
  TaskDeleted,
  TaskFinished,
  TaskRunAssigned,
  TaskRunDetached,
  TaskMarked,
  TaskMoved,
  TaskOpened,
  ToolUsed,
] as const;
