import { ChatHandedToRun } from '@work/domain/events/chat-handed-to-run.event';
import { ChatStarted } from '@work/domain/events/chat-started.event';
import { LineOpened } from '@work/domain/events/line-opened.event';
import { LineRedefined } from '@work/domain/events/line-redefined.event';
import { LineRepositoriesChanged } from '@work/domain/events/line-repositories-changed.event';
import { LineRetired } from '@work/domain/events/line-retired.event';
import { ProposalAccepted } from '@work/domain/events/proposal-accepted.event';
import { ProposalDismissed } from '@work/domain/events/proposal-dismissed.event';
import { PullRequestOpened } from '@work/domain/events/pull-request-opened.event';
import { RunAbandoned } from '@work/domain/events/run-abandoned.event';
import { RunCompleted } from '@work/domain/events/run-completed.event';
import { RunStopRequested } from '@work/domain/events/run-stop-requested.event';
import { RunSuperseded } from '@work/domain/events/run-superseded.event';
import { RunWithdrawn } from '@work/domain/events/run-withdrawn.event';
import { StationHarnessChanged } from '@work/domain/events/station-harness-changed.event';
import { StationRenamed } from '@work/domain/events/station-renamed.event';
import { TaskAsked } from '@work/domain/events/task-asked.event';
import { TaskDeleted } from '@work/domain/events/task-deleted.event';
import { TaskFinished } from '@work/domain/events/task-finished.event';
import { TaskHandedToRun } from '@work/domain/events/task-handed-to-run.event';
import { TaskLetGoOfRun } from '@work/domain/events/task-let-go-of-run.event';
import { TaskMarkTaken } from '@work/domain/events/task-mark-taken.event';
import { TaskMoved } from '@work/domain/events/task-moved.event';
import { TaskOpened } from '@work/domain/events/task-opened.event';
import { TaskProposed } from '@work/domain/events/task-proposed.event';
import { AgentPrompt } from '@work/domain/value-objects/agent-prompt.vo';
import { Approval } from '@work/domain/value-objects/approval.vo';
import { ApprovalNeeded } from '@work/domain/value-objects/approval-needed.vo';
import { ApprovalSubject } from '@work/domain/value-objects/approval-subject.vo';
import { ArchiveDigest } from '@work/domain/value-objects/archive-digest.vo';
import { ArchiveSize } from '@work/domain/value-objects/archive-size.vo';
import { Attachment } from '@work/domain/value-objects/attachment.vo';
import { AttachmentId } from '@work/domain/value-objects/attachment-id.vo';
import { Branch } from '@work/domain/value-objects/branch.vo';
import { CallingHost } from '@work/domain/value-objects/calling-host.vo';
import { CatalogWithheld } from '@work/domain/value-objects/catalog-withheld.vo';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { ChatMessageBody } from '@work/domain/value-objects/chat-message-body.vo';
import { ChatTitle } from '@work/domain/value-objects/chat-title.vo';
import { Concerns } from '@work/domain/value-objects/concerns.vo';
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
import { ProfileKey } from '@work/domain/value-objects/profile-key.vo';
import { ProfileMissing } from '@work/domain/value-objects/profile-missing.vo';
import { ProposalOrigin } from '@work/domain/value-objects/proposal-origin.vo';
import { ProposalPlacement } from '@work/domain/value-objects/proposal-placement.vo';
import { PullRequestLink } from '@work/domain/value-objects/pull-request-link.vo';
import { Reaction } from '@work/domain/value-objects/reaction.vo';
import { Remark } from '@work/domain/value-objects/remark.vo';
import { RepositorySetup } from '@work/domain/value-objects/repository-setup.vo';
import { ReviewPolicy } from '@work/domain/value-objects/review-policy.vo';
import { RunAttempt } from '@work/domain/value-objects/run-attempt.vo';
import { RunFailure } from '@work/domain/value-objects/run-failure.vo';
import { RunOutcome } from '@work/domain/value-objects/run-outcome.vo';
import { RunPriority } from '@work/domain/value-objects/run-priority.vo';
import { RunSpec } from '@work/domain/value-objects/run-spec.vo';
import { RunSubject } from '@work/domain/value-objects/run-subject.vo';
import { Said } from '@work/domain/value-objects/said.vo';
import { Signing } from '@work/domain/value-objects/signing.vo';
import { SkillKey } from '@work/domain/value-objects/skill-key.vo';
import { StationCheck } from '@work/domain/value-objects/station-check.vo';
import { StationColor } from '@work/domain/value-objects/station-color.vo';
import { StationDescription } from '@work/domain/value-objects/station-description.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { StationKey } from '@work/domain/value-objects/station-key.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { TaskDescription } from '@work/domain/value-objects/task-description.vo';
import { TaskFailure } from '@work/domain/value-objects/task-failure.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { Tool } from '@work/domain/value-objects/tool.vo';
import { ToolCall } from '@work/domain/value-objects/tool-call.vo';
import { ToolInputs } from '@work/domain/value-objects/tool-inputs.vo';
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
  LineId,
  LineKey,
  LineName,
  LinePlan,
  LineRepositories,
  WorkedRepository,
  LineRole,
  PullRequestLink,
  RepositorySetup,
  ReviewPolicy,
  Mark,
  MessagePosition,
  Money,
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
  Signing,
  SkillKey,
  StationCheck,
  StationColor,
  StationDescription,
  StationId,
  StationKey,
  StationName,
  TaskDescription,
  TaskNoteBody,
  TaskRank,
  TaskTitle,
  ToolCall,
  ToolInputs,
  Tool,
  Trail,
  Voice,
  WayOut,
  WorkspaceArchiveId,
  ChatHandedToRun,
  ChatStarted,
  LineRepositoriesChanged,
  LineOpened,
  LineRedefined,
  LineRetired,
  ProposalAccepted,
  ProposalDismissed,
  PullRequestOpened,
  RunAbandoned,
  RunWithdrawn,
  RunSuperseded,
  RunCompleted,
  RunStopRequested,
  StationHarnessChanged,
  StationRenamed,
  TaskAsked,
  TaskDeleted,
  TaskFinished,
  TaskHandedToRun,
  TaskLetGoOfRun,
  TaskMarkTaken,
  TaskMoved,
  TaskOpened,
  TaskProposed,
] as const;
