import { ChatHandedToRun } from '@work/domain/events/chat-handed-to-run.event';
import { ChatStarted } from '@work/domain/events/chat-started.event';
import { LineOpened } from '@work/domain/events/line-opened.event';
import { LineRedefined } from '@work/domain/events/line-redefined.event';
import { LineRepositoriesChanged } from '@work/domain/events/line-repositories-changed.event';
import { LineRetired } from '@work/domain/events/line-retired.event';
import { ProposalAccepted } from '@work/domain/events/proposal-accepted.event';
import { ProposalDismissed } from '@work/domain/events/proposal-dismissed.event';
import { PullRequestOpened } from '@work/domain/events/pull-request-opened.event';
import { PullRequestReviewTaken } from '@work/domain/events/pull-request-review-taken.event';
import { ReplayDigested } from '@work/domain/events/replay-digested.event';
import { RunAbandoned } from '@work/domain/events/run-abandoned.event';
import { RunBriefed } from '@work/domain/events/run-briefed.event';
import { RunCompleted } from '@work/domain/events/run-completed.event';
import { RunDigested } from '@work/domain/events/run-digested.event';
import { RunLapsed } from '@work/domain/events/run-lapsed.event';
import { RunParked } from '@work/domain/events/run-parked.event';
import { RunPaused } from '@work/domain/events/run-paused.event';
import { RunReservationDropped } from '@work/domain/events/run-reservation-dropped.event';
import { RunResumed } from '@work/domain/events/run-resumed.event';
import { RunStopRequested } from '@work/domain/events/run-stop-requested.event';
import { RunSuperseded } from '@work/domain/events/run-superseded.event';
import { RunWithdrawn } from '@work/domain/events/run-withdrawn.event';
import { SearchDigested } from '@work/domain/events/search-digested.event';
import { StationHarnessChanged } from '@work/domain/events/station-harness-changed.event';
import { StationRenamed } from '@work/domain/events/station-renamed.event';
import { TaskActedOn } from '@work/domain/events/task-acted-on.event';
import { TaskAnswered } from '@work/domain/events/task-answered.event';
import { TaskAsideRaised } from '@work/domain/events/task-aside-raised.event';
import { TaskAsideSettled } from '@work/domain/events/task-aside-settled.event';
import { TaskAsked } from '@work/domain/events/task-asked.event';
import { TaskDeleted } from '@work/domain/events/task-deleted.event';
import { TaskFailed } from '@work/domain/events/task-failed.event';
import { TaskFinished } from '@work/domain/events/task-finished.event';
import { TaskHandedOn } from '@work/domain/events/task-handed-on.event';
import { TaskHandedToRun } from '@work/domain/events/task-handed-to-run.event';
import { TaskLetGoOfRun } from '@work/domain/events/task-let-go-of-run.event';
import { TaskMarkTaken } from '@work/domain/events/task-mark-taken.event';
import { TaskMoved } from '@work/domain/events/task-moved.event';
import { TaskOpened } from '@work/domain/events/task-opened.event';
import { TaskProposed } from '@work/domain/events/task-proposed.event';
import { ToolUsed } from '@work/domain/events/tool-used.event';
import { AgentPrompt } from '@work/domain/value-objects/agent-prompt.vo';
import { Approval } from '@work/domain/value-objects/approval.vo';
import { ApprovalNeeded } from '@work/domain/value-objects/approval-needed.vo';
import { ApprovalSubject } from '@work/domain/value-objects/approval-subject.vo';
import { ArchiveDigest } from '@work/domain/value-objects/archive-digest.vo';
import { ArchiveSize } from '@work/domain/value-objects/archive-size.vo';
import { AsideAbout } from '@work/domain/value-objects/aside-about.vo';
import { AsideRead } from '@work/domain/value-objects/aside-read.vo';
import { Attachment } from '@work/domain/value-objects/attachment.vo';
import { AttachmentId } from '@work/domain/value-objects/attachment-id.vo';
import { Branch } from '@work/domain/value-objects/branch.vo';
import { BriefedMemories } from '@work/domain/value-objects/briefed-memories.vo';
import { BriefedTask } from '@work/domain/value-objects/briefed-task.vo';
import { CalledTool } from '@work/domain/value-objects/called-tool.vo';
import { CallingHost } from '@work/domain/value-objects/calling-host.vo';
import { CatalogWithheld } from '@work/domain/value-objects/catalog-withheld.vo';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { ChatMessageBody } from '@work/domain/value-objects/chat-message-body.vo';
import { ChatTitle } from '@work/domain/value-objects/chat-title.vo';
import { Concerns } from '@work/domain/value-objects/concerns.vo';
import { ConfigSource } from '@work/domain/value-objects/config-source.vo';
import { Continuity } from '@work/domain/value-objects/continuity.vo';
import { ContinuityKey } from '@work/domain/value-objects/continuity-key.vo';
import { ConversationId } from '@work/domain/value-objects/conversation-id.vo';
import { Declaration } from '@work/domain/value-objects/declaration.vo';
import { DeclaredTool } from '@work/domain/value-objects/declared-tool.vo';
import { Effort } from '@work/domain/value-objects/effort.vo';
import { HandBacks } from '@work/domain/value-objects/hand-backs.vo';
import { HandoverOption } from '@work/domain/value-objects/handover-option.vo';
import { HandoverReport } from '@work/domain/value-objects/handover-report.vo';
import { Happening } from '@work/domain/value-objects/happening.vo';
import { Harness } from '@work/domain/value-objects/harness.vo';
import { HarnessCommand } from '@work/domain/value-objects/harness-command.vo';
import { HarnessName } from '@work/domain/value-objects/harness-name.vo';
import { HarnessPermission } from '@work/domain/value-objects/harness-permission.vo';
import { HarnessSession } from '@work/domain/value-objects/harness-session.vo';
import { HeldBack } from '@work/domain/value-objects/held-back.vo';
import { ImprovedStation } from '@work/domain/value-objects/improved-station.vo';
import { LineId } from '@work/domain/value-objects/line-id.vo';
import { LineKey } from '@work/domain/value-objects/line-key.vo';
import { LineName } from '@work/domain/value-objects/line-name.vo';
import { LinePlan } from '@work/domain/value-objects/line-plan.vo';
import { LineRepositories } from '@work/domain/value-objects/line-repositories.vo';
import { LineRole } from '@work/domain/value-objects/line-role.vo';
import { Mark } from '@work/domain/value-objects/mark.vo';
import { MessagePosition } from '@work/domain/value-objects/message-position.vo';
import { Money } from '@work/domain/value-objects/money.vo';
import { NetworkAnswer } from '@work/domain/value-objects/network-answer.vo';
import { NetworkCallId } from '@work/domain/value-objects/network-call-id.vo';
import { NetworkRequest } from '@work/domain/value-objects/network-request.vo';
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
import { Remark } from '@work/domain/value-objects/remark.vo';
import { ReplayCheckPolicy } from '@work/domain/value-objects/replay-check-policy.vo';
import { ReplayRunClaim } from '@work/domain/value-objects/replay-run-claim.vo';
import { RepositorySetup } from '@work/domain/value-objects/repository-setup.vo';
import { RestoredArchive } from '@work/domain/value-objects/restored-archive.vo';
import { ReviewPolicy } from '@work/domain/value-objects/review-policy.vo';
import { RunAttempt } from '@work/domain/value-objects/run-attempt.vo';
import { RunFailure } from '@work/domain/value-objects/run-failure.vo';
import { RunOutcome } from '@work/domain/value-objects/run-outcome.vo';
import { RunPriority } from '@work/domain/value-objects/run-priority.vo';
import { RunSpec } from '@work/domain/value-objects/run-spec.vo';
import { RunSubject } from '@work/domain/value-objects/run-subject.vo';
import { Said } from '@work/domain/value-objects/said.vo';
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
import { TaskAsideId } from '@work/domain/value-objects/task-aside-id.vo';
import { TaskDescription } from '@work/domain/value-objects/task-description.vo';
import { TaskFailure } from '@work/domain/value-objects/task-failure.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { TaskOrigin } from '@work/domain/value-objects/task-origin.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskRevision } from '@work/domain/value-objects/task-revision.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { Tokens } from '@work/domain/value-objects/tokens.vo';
import { Tool } from '@work/domain/value-objects/tool.vo';
import { ToolCall } from '@work/domain/value-objects/tool-call.vo';
import { ToolInputs } from '@work/domain/value-objects/tool-inputs.vo';
import { ToolOutput } from '@work/domain/value-objects/tool-output.vo';
import { ToolUse } from '@work/domain/value-objects/tool-use.vo';
import { TraceReference } from '@work/domain/value-objects/trace-reference.vo';
import { Trail } from '@work/domain/value-objects/trail.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';
import { WayOut } from '@work/domain/value-objects/way-out.vo';
import { WorkedRepository } from '@work/domain/value-objects/worked-repository.vo';
import { WorkspaceArchiveId } from '@work/domain/value-objects/workspace-archive-id.vo';

export const WORK_EVENT_TYPES = [
  AgentPrompt,
  Approval,
  ApprovalNeeded,
  ApprovalSubject,
  ArchiveDigest,
  ArchiveSize,
  AttachmentId,
  Attachment,
  Branch,
  CallingHost,
  CatalogWithheld,
  ChatId,
  ChatMessageBody,
  ChatTitle,
  Concerns,
  Continuity,
  ContinuityKey,
  ConversationId,
  Declaration,
  DeclaredTool,
  Effort,
  HarnessPermission,
  ProfileKey,
  ProfileMissing,
  HandBacks,
  HandoverOption,
  HandoverReport,
  Happening,
  Harness,
  HarnessCommand,
  HarnessName,
  HarnessSession,
  ImprovedStation,
  HeldBack,
  LineId,
  LineKey,
  LineName,
  LinePlan,
  LineRepositories,
  WorkedRepository,
  LineRole,
  PullRequestLink,
  RepositorySetup,
  ReplayCheckPolicy,
  ConfigSource,
  ReviewPolicy,
  Mark,
  MessagePosition,
  Money,
  ReplayRunClaim,
  Tokens,
  ToolUse,
  CalledTool,
  NetworkAnswer,
  NetworkCallId,
  NetworkRequest,
  NotePosition,
  ProposalOrigin,
  ProposalPlacement,
  Reaction,
  Remark,
  RunAttempt,
  RunOutcome,
  RunFailure,
  TaskFailure,
  RunPriority,
  RunSpec,
  RunSubject,
  Said,
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
  ToolInputs,
  ToolOutput,
  Tool,
  Trail,
  TraceReference,
  Voice,
  WayOut,
  WorkspaceArchiveId,
  TaskAsideId,
  NoticeId,
  NoticeLink,
  NoticeWording,
  AsideAbout,
  AsideRead,
  BriefedMemories,
  BriefedTask,
  RestoredArchive,
  StartedCheckout,
  StartingPoint,
  ChatHandedToRun,
  ChatStarted,
  LineRepositoriesChanged,
  LineOpened,
  LineRedefined,
  LineRetired,
  ProposalAccepted,
  ProposalDismissed,
  PullRequestOpened,
  PullRequestReviewTaken,
  RunAbandoned,
  RunWithdrawn,
  RunBriefed,
  RunSuperseded,
  RunCompleted,
  RunDigested,
  ReplayDigested,
  SearchDigested,
  TaskFailed,
  TaskHandedOn,
  RunLapsed,
  RunParked,
  RunPaused,
  RunResumed,
  RunReservationDropped,
  RunStopRequested,
  StationHarnessChanged,
  StationRenamed,
  TaskActedOn,
  TaskAnswered,
  TaskAsked,
  TaskAsideRaised,
  TaskAsideSettled,
  TaskDeleted,
  TaskFinished,
  TaskHandedToRun,
  TaskLetGoOfRun,
  TaskMarkTaken,
  TaskMoved,
  TaskOpened,
  TaskProposed,
  ToolUsed,
] as const;
